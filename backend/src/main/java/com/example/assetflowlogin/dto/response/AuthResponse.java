package com.example.assetflowlogin.dto.response;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthResponse {

    private String accessToken;

    private String refreshToken;

    private String tokenType = "Bearer";

    private UserResponse user;

}
