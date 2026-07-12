package com.example.assetflowlogin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import com.example.assetflowlogin.security.jwt.JwtProperties;

@SpringBootApplication
@EnableConfigurationProperties(JwtProperties.class)
public class AssetflowloginApplication {

	public static void main(String[] args) {
		SpringApplication.run(AssetflowloginApplication.class, args);
	}

}
