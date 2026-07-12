package com.example.assetflowlogin.controller;

import com.example.assetflowlogin.dto.request.ForgotPasswordRequest;
import com.example.assetflowlogin.dto.request.LoginRequest;
import com.example.assetflowlogin.dto.request.RefreshTokenRequest;
import com.example.assetflowlogin.dto.request.RegisterRequest;
import com.example.assetflowlogin.dto.request.ResetPasswordRequest;
import com.example.assetflowlogin.dto.request.VerifyEmailRequest;
import com.example.assetflowlogin.dto.response.APIResponse;
import com.example.assetflowlogin.dto.response.AuthResponse;
import com.example.assetflowlogin.dto.response.UserResponse;
import com.example.assetflowlogin.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Authentication", description = "Registration, login, and account-recovery endpoints")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "Register a new employee account")
    @PostMapping("/register")
    public APIResponse<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @Operation(summary = "Verify an account using the OTP sent by email")
    @PostMapping("/verify-email")
    public APIResponse<String> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return authService.verifyEmail(request);
    }

    @Operation(summary = "Authenticate with email and password")
    @PostMapping("/login")
    public APIResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @Operation(summary = "Exchange a valid refresh token for a new access token")
    @PostMapping("/refresh")
    public APIResponse<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return authService.refreshToken(request);
    }

    @Operation(summary = "Invalidate a refresh token")
    @PostMapping("/logout")
    public APIResponse<String> logout(@Valid @RequestBody RefreshTokenRequest request) {
        return authService.logout(request);
    }

    @Operation(summary = "Request a password-reset OTP by email")
    @PostMapping("/forgot-password")
    public APIResponse<String> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return authService.forgotPassword(request);
    }

    @Operation(summary = "Reset password using the OTP from forgot-password")
    @PostMapping("/reset-password")
    public APIResponse<String> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return authService.resetPassword(request);
    }
}