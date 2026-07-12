package com.example.assetflowlogin.exceptions;

public class AssetAlreadyAllocatedException extends RuntimeException {
    public AssetAlreadyAllocatedException(String message) {
        super(message);
    }
}