package com.example.assetflowlogin.service;

import com.example.assetflowlogin.entity.RefreshToken;
import com.example.assetflowlogin.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository repository;

    public RefreshToken save(RefreshToken token) {
        return repository.save(token);
    }

    public void delete(RefreshToken token) {
        repository.delete(token);
    }

}