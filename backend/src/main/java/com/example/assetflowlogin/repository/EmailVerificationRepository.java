package com.example.assetflowlogin.repository;

import com.example.assetflowlogin.entity.EmailVerification;
import com.example.assetflowlogin.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {

    Optional<EmailVerification> findByUser(User user);

}