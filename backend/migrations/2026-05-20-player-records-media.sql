CREATE TABLE IF NOT EXISTS player_match_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    match_date DATE NULL,
    opponent VARCHAR(120) DEFAULT '',
    goals INT NOT NULL DEFAULT 0,
    clean_sheet TINYINT(1) NOT NULL DEFAULT 0,
    tackles INT NOT NULL DEFAULT 0,
    role VARCHAR(40) DEFAULT '',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_player_match_records_player_id (player_id),
    INDEX idx_player_match_records_match_date (match_date),
    CONSTRAINT fk_player_match_records_player
        FOREIGN KEY (player_id)
        REFERENCES players(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NULL,
    title VARCHAR(160) DEFAULT '',
    media_type ENUM('photo', 'video') NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_player_media_player_id (player_id),
    INDEX idx_player_media_media_type (media_type),
    CONSTRAINT fk_player_media_player
        FOREIGN KEY (player_id)
        REFERENCES players(id)
        ON DELETE SET NULL
);
