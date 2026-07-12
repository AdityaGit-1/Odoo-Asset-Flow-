package com.example.assetflowlogin.service.impl;

import com.example.assetflowlogin.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromAddress;

    @Value("${app.otp.expiry-minutes:10}")
    private int otpExpiryMinutes;

    @Override
    public void sendVerificationEmail(String toEmail, String firstName, String otp) {
        String subject = "Verify your AssetFlow account";
        String body = """
                Hi %s,

                Welcome to AssetFlow. Use the code below to verify your email address:

                    %s

                This code expires in %d minutes. If you did not create this account, you can ignore this email.

                - AssetFlow Team
                """.formatted(firstName, otp, otpExpiryMinutes);

        send(toEmail, subject, body);
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String firstName, String otp) {
        String subject = "AssetFlow password reset code";
        String body = """
                Hi %s,

                We received a request to reset your AssetFlow password. Use the code below to continue:

                    %s

                This code expires in %d minutes. If you did not request a password reset, please ignore this email
                or contact support if you believe your account may be compromised.

                - AssetFlow Team
                """.formatted(firstName, otp, otpExpiryMinutes);

        send(toEmail, subject, body);
    }

    private void send(String toEmail, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (Exception ex) {
            // Email delivery failures should not surface raw stack traces to the
            // caller; log and let the caller decide how to handle downstream impact.
            log.error("Failed to send email to {}: {}", toEmail, ex.getMessage(), ex);
        }
    }
}