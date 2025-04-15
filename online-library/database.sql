-- Main database
CREATE DATABASE IF NOT EXISTS online_library;
USE online_library;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_verified BOOLEAN DEFAULT FALSE
);

-- OTP storage
CREATE TABLE IF NOT EXISTS otp_verification (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

-- Function to create user-specific database
DELIMITER //
CREATE PROCEDURE create_user_database(IN user_email VARCHAR(100))
BEGIN
    SET @db_name = REPLACE(REPLACE(user_email, '@', '_'), '.', '_');
    SET @create_db = CONCAT('CREATE DATABASE IF NOT EXISTS `', @db_name, '`');
    PREPARE stmt FROM @create_db;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    
    SET @create_readlater = CONCAT('
        CREATE TABLE IF NOT EXISTS `', @db_name, '`.readlater (
            id INT AUTO_INCREMENT PRIMARY KEY,
            manga_id VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            thumbnail_url VARCHAR(255) NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )');
    PREPARE stmt FROM @create_readlater;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    
    SET @create_library = CONCAT('
        CREATE TABLE IF NOT EXISTS `', @db_name, '`.library (
            id INT AUTO_INCREMENT PRIMARY KEY,
            manga_id VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            pdf_url VARCHAR(255) NOT NULL,
            thumbnail_url VARCHAR(255) NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_read TIMESTAMP NULL,
            page_number INT DEFAULT 0
        )');
    PREPARE stmt FROM @create_library;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END //
DELIMITER ;