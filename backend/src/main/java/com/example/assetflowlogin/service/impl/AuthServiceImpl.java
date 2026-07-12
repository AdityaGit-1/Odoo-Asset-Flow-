package com.example.assetflowlogin.service.impl;

import com.example.assetflowlogin.dto.request.ForgotPasswordRequest;
import com.example.assetflowlogin.dto.request.LoginRequest;
import com.example.assetflowlogin.dto.request.RefreshTokenRequest;
import com.example.assetflowlogin.dto.request.RegisterRequest;
import com.example.assetflowlogin.dto.request.ResetPasswordRequest;
import com.example.assetflowlogin.dto.request.VerifyEmailRequest;
import com.example.assetflowlogin.dto.response.APIResponse;
import com.example.assetflowlogin.dto.response.AuthResponse;
import com.example.assetflowlogin.dto.response.UserResponse;
import com.example.assetflowlogin.entity.Department;
import com.example.assetflowlogin.entity.EmailVerification;
import com.example.assetflowlogin.entity.PasswordResetToken;
import com.example.assetflowlogin.entity.RefreshToken;
import com.example.assetflowlogin.entity.Role;
import com.example.assetflowlogin.entity.User;
import com.example.assetflowlogin.enums.Rolename;
import com.example.assetflowlogin.enums.UserStatus;
import com.example.assetflowlogin.exception.EmailAlreadyExistsException;
import com.example.assetflowlogin.exception.InvalidOtpException;
import com.example.assetflowlogin.exception.ResourceNotFoundException;
import com.example.assetflowlogin.exception.TokenExpiredException;
import com.example.assetflowlogin.repository.DepartmentRepository;
import com.example.assetflowlogin.repository.EmailVerificationRepository;
import com.example.assetflowlogin.repository.PasswordResetTokenRepository;
import com.example.assetflowlogin.repository.RefreshTokenRepository;
import com.example.assetflowlogin.repository.RoleRepository;
import com.example.assetflowlogin.repository.UserRepository;
import com.example.assetflowlogin.security.jwt.JwtProperties;
import com.example.assetflowlogin.security.jwt.JwtService;
import com.example.assetflowlogin.service.AuthService;
import com.example.assetflowlogin.service.EmailService;
import com.example.assetflowlogin.service.OtpService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final int OTP_EXPIRY_MINUTES = 10;

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final DepartmentRepository departmentRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final EmailVerificationRepository emailVerificationRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;

    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;

    private final EmailService emailService;
    private final OtpService otpService;

    // ------------------------------------------------------------------
    // Register
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public APIResponse<UserResponse> register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new EmailAlreadyExistsException(request.getEmail());
        }

        Department department = departmentRepository.findById(request.getDepartmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.getDepartmentId()));

        Role employeeRole = roleRepository.findByName(Rolename.EMPLOYEE)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "name", Rolename.EMPLOYEE));

        User user = new User();
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setDepartment(department);
        user.setRoles(new HashSet<>(Set.of(employeeRole)));
        user.setEnabled(false);
        user.setEmailVerified(false);
        user.setStatus(UserStatus.ACTIVE);
        user.setFailedAttempts(0);

        // First save so the database assigns an id; employeeCode is derived
        // from that id, never from repository.count(), so codes are never reused.
        user = userRepository.save(user);
        user.setEmployeeCode(generateEmployeeCode(user.getId()));
        user = userRepository.save(user);

        issueEmailVerificationOtp(user);

        log.info("New user registered: {} ({})", user.getEmail(), user.getEmployeeCode());

        return APIResponse.success(
                "Registration successful. Please verify your email using the OTP sent to " + user.getEmail(),
                toUserResponse(user));
    }

    private String generateEmployeeCode(Long id) {
        return String.format("EMP%05d", id);
    }

    private void issueEmailVerificationOtp(User user) {
        String otp = otpService.generateOtp();

        EmailVerification verification = new EmailVerification();
        verification.setUser(user);
        verification.setOtp(otp);
        verification.setExpiry(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
        verification.setVerified(false);
        emailVerificationRepository.save(verification);

        emailService.sendVerificationEmail(user.getEmail(), user.getFirstName(), otp);
    }

    // ------------------------------------------------------------------
    // Verify Email
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public APIResponse<String> verifyEmail(VerifyEmailRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", request.getEmail()));

        EmailVerification verification = emailVerificationRepository
                .findTopByUserAndVerifiedFalseOrderByIdDesc(user)
                .orElseThrow(InvalidOtpException::new);

        if (!verification.getOtp().equals(request.getOtp())) {
            throw new InvalidOtpException("The OTP you entered is incorrect.");
        }

        if (verification.getExpiry().isBefore(LocalDateTime.now())) {
            throw new TokenExpiredException("This OTP has expired. Please request a new one.");
        }

        verification.setVerified(true);
        emailVerificationRepository.save(verification);

        user.setEmailVerified(true);
        user.setEnabled(true);
        userRepository.save(user);

        return APIResponse.success("Email verified successfully. You can now log in.", null);
    }

    // ------------------------------------------------------------------
    // Login
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public APIResponse<AuthResponse> login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", request.getEmail()));

        if (!user.isEmailVerified()) {
            throw new IllegalStateException("Please verify your email before logging in.");
        }

        // Delegates credential checking to the configured DaoAuthenticationProvider,
        // which in turn uses CustomUserDetailsService + PasswordEncoder. This also
        // keeps account-locking / disabled-account checks centralised in Spring Security.
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        user.setFailedAttempts(0);
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        String accessToken = jwtService.generateAccessToken(user.getEmail());
        String refreshTokenValue = jwtService.generateRefreshToken(user.getEmail());

        // RefreshToken is a @OneToOne with User, so each user has at most one
        // active refresh token row - reuse it on re-login instead of inserting
        // a second row for the same user.
        RefreshToken refreshToken = refreshTokenRepository.findByUser(user).orElseGet(RefreshToken::new);
        refreshToken.setUser(user);
        refreshToken.setToken(refreshTokenValue);
        refreshToken.setExpiry(LocalDateTime.now().plus(Duration.ofMillis(jwtProperties.getRefreshTokenExpiration())));
        refreshToken.setRevoked(false);
        refreshTokenRepository.save(refreshToken);

        return APIResponse.success("Login successful.",
                toAuthResponse(accessToken, refreshTokenValue, user));
    }

    // ------------------------------------------------------------------
    // Refresh Token
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public APIResponse<AuthResponse> refreshToken(RefreshTokenRequest request) {
        RefreshToken storedToken = refreshTokenRepository.findByToken(request.getRefreshToken())
                .orElseThrow(() -> new ResourceNotFoundException("Refresh token not found."));

        if (Boolean.TRUE.equals(storedToken.getRevoked())) {
            throw new TokenExpiredException("This refresh token has been revoked. Please log in again.");
        }

        // isTokenValid() parses the signed JWT and returns false on any parsing
        // failure, including an expired token (jjwt throws ExpiredJwtException,
        // which is caught internally) - so this covers signature and expiry,
        // and the stored expiry is checked too as a belt-and-suspenders guard.
        if (storedToken.getExpiry().isBefore(LocalDateTime.now())
                || !jwtService.isTokenValid(storedToken.getToken())) {
            throw new TokenExpiredException("Refresh token has expired. Please log in again.");
        }

        User user = storedToken.getUser();
        String newAccessToken = jwtService.generateAccessToken(user.getEmail());

        return APIResponse.success("Access token refreshed.",
                toAuthResponse(newAccessToken, storedToken.getToken(), user));
    }

    // ------------------------------------------------------------------
    // Logout
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public APIResponse<String> logout(RefreshTokenRequest request) {
        refreshTokenRepository.findByToken(request.getRefreshToken())
                .ifPresent(refreshTokenRepository::delete);

        return APIResponse.success("Logged out successfully.", null);
    }

    // ------------------------------------------------------------------
    // Forgot Password
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public APIResponse<String> forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", request.getEmail()));

        String otp = otpService.generateOtp();

        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setUser(user);
        resetToken.setOtp(otp);
        resetToken.setExpiry(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
        resetToken.setUsed(false);
        passwordResetTokenRepository.save(resetToken);

        emailService.sendPasswordResetEmail(user.getEmail(), user.getFirstName(), otp);

        return APIResponse.success("Password reset OTP sent to " + user.getEmail(), null);
    }

    // ------------------------------------------------------------------
    // Reset Password
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public APIResponse<String> resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", request.getEmail()));

        PasswordResetToken resetToken = passwordResetTokenRepository
                .findTopByUserAndUsedFalseOrderByIdDesc(user)
                .orElseThrow(InvalidOtpException::new);

        if (!resetToken.getOtp().equals(request.getOtp())) {
            throw new InvalidOtpException("The OTP you entered is incorrect.");
        }

        if (resetToken.getExpiry().isBefore(LocalDateTime.now())) {
            throw new TokenExpiredException("This OTP has expired. Please request a new one.");
        }

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Invalidate the existing session so the old password can no longer be
        // used to mint fresh access tokens via a stale refresh token.
        refreshTokenRepository.findByUser(user).ifPresent(refreshTokenRepository::delete);

        return APIResponse.success("Password reset successfully. Please log in with your new password.", null);
    }

    // ------------------------------------------------------------------
    // Mapping helpers
    // ------------------------------------------------------------------

    /**
     * UserResponse is a plain @Getter/@Setter DTO (no builder), so it's
     * assembled here via setters.
     */
    private UserResponse toUserResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setEmployeeCode(user.getEmployeeCode());
        response.setFirstName(user.getFirstName());
        response.setLastName(user.getLastName());
        response.setEmail(user.getEmail());
        response.setRoles(user.getRoles().stream()
                .map(role -> role.getName().name())
                .collect(Collectors.toSet()));
        return response;
    }

    /**
     * AuthResponse is also a plain @Getter/@Setter DTO; tokenType already
     * defaults to "Bearer" on the class itself.
     */
    private AuthResponse toAuthResponse(String accessToken, String refreshToken, User user) {
        AuthResponse response = new AuthResponse();
        response.setAccessToken(accessToken);
        response.setRefreshToken(refreshToken);
        response.setUser(toUserResponse(user));
        return response;
    }
}