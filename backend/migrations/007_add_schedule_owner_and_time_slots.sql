ALTER TABLE schedule_courses ADD COLUMN owner VARCHAR(20) NOT NULL DEFAULT 'me' COMMENT '课程归属 (me/partner)' AFTER id;

CREATE TABLE IF NOT EXISTS schedule_time_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner VARCHAR(20) NOT NULL COMMENT '归属 (me/partner)',
  slot_number TINYINT NOT NULL COMMENT '节次编号',
  start_time VARCHAR(5) NOT NULL COMMENT '开始时间 HH:mm',
  end_time VARCHAR(5) NOT NULL COMMENT '结束时间 HH:mm',
  UNIQUE KEY uk_owner_slot (owner, slot_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课表时间配置';

INSERT INTO schedule_time_slots (owner, slot_number, start_time, end_time) VALUES
  ('me', 1, '08:10', '08:55'),
  ('me', 2, '09:05', '09:50'),
  ('me', 3, '10:10', '10:55'),
  ('me', 4, '11:05', '11:50'),
  ('me', 5, '13:30', '14:15'),
  ('me', 6, '14:25', '15:10'),
  ('me', 7, '15:30', '16:15'),
  ('me', 8, '16:25', '17:10'),
  ('me', 9, '18:20', '19:05'),
  ('me', 10, '19:10', '19:55'),
  ('me', 11, '20:00', '20:45'),
  ('me', 12, '20:50', '21:35'),
  ('partner', 1, '08:00', '08:45'),
  ('partner', 2, '08:50', '09:35'),
  ('partner', 3, '09:50', '10:35'),
  ('partner', 4, '10:40', '11:25'),
  ('partner', 5, '11:30', '12:15'),
  ('partner', 6, '13:40', '14:25'),
  ('partner', 7, '14:30', '15:15'),
  ('partner', 8, '15:30', '16:15'),
  ('partner', 9, '16:20', '17:05'),
  ('partner', 10, '18:00', '18:45'),
  ('partner', 11, '18:50', '19:35'),
  ('partner', 12, '19:40', '20:25');
