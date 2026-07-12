package com.example.assetflowlogin.dto.request;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {

    @NotBlank(message = "First name is required")
    private String firstName;

    private String lastName;

    @Email
    @NotBlank(message = "Email is required")
    private String email;

    @NotBlank
    @Size(min = 8, max = 100)
    private String password;

    @NotNull
    private Long departmentId;
}