package com.example.assetflowlogin.repository;

import com.example.assetflowlogin.entity.PasswordResetToken;
import com.example.assetflowlogin.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PasswordResetRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByUser(User user);

}