CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT,
    attendance_date DATE,
    status ENUM('present', 'absent', 'late') DEFAULT 'absent',
    FOREIGN KEY (player_id) REFERENCES players(id)
);