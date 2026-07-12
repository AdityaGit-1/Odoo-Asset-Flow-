package com.example.assetflowlogin.util;

import com.example.assetflowlogin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EmployeeCodeGenerator {

    private final UserRepository userRepository;

    public String generateEmployeeCode() {

        long count = userRepository.count() + 1;

        return String.format("EMP%05d", count);

    }
}