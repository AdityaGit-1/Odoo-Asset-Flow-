package com.example.assetflowlogin.service;

import com.example.assetflowlogin.dto.request.ForgotPasswordRequest;
import com.example.assetflowlogin.dto.request.LoginRequest;
import com.example.assetflowlogin.dto.request.RefreshTokenRequest;
import com.example.assetflowlogin.dto.request.RegisterRequest;
import com.example.assetflowlogin.dto.request.ResetPasswordRequest;
import com.example.assetflowlogin.dto.request.VerifyEmailRequest;
import com.example.assetflowlogin.dto.response.APIResponse;
import com.example.assetflowlogin.dto.response.AuthResponse;
import com.example.assetflowlogin.dto.response.UserResponse;

public interface AuthService {

    APIResponse<UserResponse> register(RegisterRequest request);

    APIResponse<AuthResponse> login(LoginRequest request);

    APIResponse<String> verifyEmail(VerifyEmailRequest request);

    APIResponse<AuthResponse> refreshToken(RefreshTokenRequest request);

    APIResponse<String> logout(RefreshTokenRequest request);

    APIResponse<String> forgotPassword(ForgotPasswordRequest request);

    APIResponse<String> resetPassword(ResetPasswordRequest request);
}