CREATE DATABASE IF NOT EXISTS gym;
USE gym;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('client', 'trainer', 'admin') NOT NULL,
    total_visits INT DEFAULT 0,
    discount_percent INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE trainer_profiles (
    trainer_id INT PRIMARY KEY,
    specialty VARCHAR(255) NOT NULL,
    experience_years INT CHECK (experience_years >= 0),
    bio TEXT,
    FOREIGN KEY (trainer_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE subscription_types (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category ENUM('gym', 'group', 'combined') NOT NULL,
    duration_months INT NULL,
    visits_count INT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    final_price DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE subscriptions (
    subscription_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type_id INT NOT NULL,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    visits_remaining INT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (type_id) REFERENCES subscription_types(type_id)
);

CREATE TABLE trainer_programs (
    program_id INT AUTO_INCREMENT PRIMARY KEY,
    trainer_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_per_session DECIMAL(10,2),
    duration_minutes INT DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (trainer_id) REFERENCES users(user_id)
);

CREATE TABLE schedule (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    trainer_id INT NOT NULL,
    program_id INT NULL,
    session_type ENUM('individual', 'group') NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_participants INT DEFAULT 1,
    current_participants INT DEFAULT 0,
    is_cancelled BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (trainer_id) REFERENCES users(user_id),
    FOREIGN KEY (program_id) REFERENCES trainer_programs(program_id)
);

CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    schedule_id INT NOT NULL,
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    with_trainer BOOLEAN DEFAULT FALSE,
    status ENUM('booked', 'attended', 'cancelled', 'no_show') DEFAULT 'booked',
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (schedule_id) REFERENCES schedule(schedule_id)
);

CREATE TABLE attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    schedule_id INT NOT NULL,
    attendance_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    marked_by_trainer_id INT NULL,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (schedule_id) REFERENCES schedule(schedule_id),
    FOREIGN KEY (marked_by_trainer_id) REFERENCES users(user_id)
);

-- пароль admin
INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES
('admin@gym.com', '$2a$10$qNQ/6SN2onSRjGjquerY0OgUotQKx2q7uVjEe2qNmE.PdQ.I/KWla', 'Дарья', 'Марченко', '+375298502529', 'admin');

-- пароль trainer
INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES
('nikita@gym.com', '$2a$10$53IPG6JrmESQZXpzWv8TCu4McExdHgtO58nE16Sq3WLxVnurlsA9m', 'Никита', 'Слука', '+375447121537', 'trainer'),
('masha@gym.com', '$2a$10$53IPG6JrmESQZXpzWv8TCu4McExdHgtO58nE16Sq3WLxVnurlsA9m', 'Мария', 'Марченко', '+375339003891', 'trainer'),
('artem@gym.com', '$2a$10$53IPG6JrmESQZXpzWv8TCu4McExdHgtO58nE16Sq3WLxVnurlsA9m', 'Артем', 'Свидерский', '+375295312416', 'trainer');

INSERT INTO trainer_profiles (trainer_id, specialty, experience_years, bio) VALUES
(2, 'Силовой тренинг', 5, 'Помогаю развивать силу с индивидуальным подходом.'),
(3, 'Йога', 7, 'Сертифицированный инструктор по йоге.'),
(4, 'Кардио', 4, 'Создаю интенсивные программы для развития выносливости.');

-- пароль client
INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES
('matvei@gmail.com', '$2a$10$gR.zz0/ZzekMQrC93da31uTet1TTrE7v4/GIbUARGCJzuxzpD4eLa', 'Матвей', 'Коржовник', '+375298764523', 'client'),
('lera@gmail.com', '$2a$10$gR.zz0/ZzekMQrC93da31uTet1TTrE7v4/GIbUARGCJzuxzpD4eLa', 'Валерия', 'Леутко', '+375298007932', 'client');

INSERT INTO subscription_types (name, category, duration_months, visits_count, base_price, final_price, description) VALUES
('Безлимитный тренажерный (1 месяц)', 'gym', 1, NULL, 80.00, 80.00, 'Неограниченное посещение тренажерного зала на 1 месяц'),
('Безлимитный тренажерный (3 месяца)', 'gym', 3, NULL, 210.00, 210.00, 'Неограниченное посещение тренажерного зала на 3 месяца'),
('Безлимитный тренажерный (6 месяцев)', 'gym', 6, NULL, 380.00, 380.00, 'Неограниченное посещение тренажерного зала на 6 месяцев'),
('Безлимитный тренажерный (12 месяцев)', 'gym', 12, NULL, 700.00, 700.00, 'Неограниченное посещение тренажерного зала на 12 месяцев'),

('Безлимитный групповые (1 месяц)', 'group', 1, NULL, 100.00, 100.00, 'Неограниченное посещение групповых тренировок на 1 месяц'),
('Безлимитный групповые (3 месяца)', 'group', 3, NULL, 270.00, 270.00, 'Неограниченное посещение групповых тренировок на 3 месяца'),
('Безлимитный групповые (6 месяцев)', 'group', 6, NULL, 500.00, 500.00, 'Неограниченное посещение групповых тренировок на 6 месяцев'),
('Безлимитный групповые (12 месяцев)', 'group', 12, NULL, 900.00, 900.00, 'Неограниченное посещение групповых тренировок на 12 месяцев'),

('Фиксированный тренажерный (1 посещение)', 'gym', NULL, 1, 10.00, 10.00, '1 посещение тренажерного зала'),
('Фиксированный тренажерный (4 посещения)', 'gym', NULL, 4, 35.00, 35.00, '4 посещения тренажерного зала'),
('Фиксированный тренажерный (8 посещений)', 'gym', NULL, 8, 60.00, 60.00, '8 посещений тренажерного зала'),
('Фиксированный тренажерный (12 посещений)', 'gym', NULL, 12, 80.00, 80.00, '12 посещений тренажерного зала'),

('Фиксированный групповые (1 посещение)', 'group', NULL, 1, 15.00, 15.00, '1 посещение групповой тренировки'),
('Фиксированный групповые (4 посещения)', 'group', NULL, 4, 50.00, 50.00, '4 посещения групповых тренировок'),
('Фиксированный групповые (8 посещений)', 'group', NULL, 8, 90.00, 90.00, '8 посещений групповых тренировок'),
('Фиксированный групповые (12 посещений)', 'group', NULL, 12, 120.00, 120.00, '12 посещений групповых тренировок'),

('Безлимит общий (1 месяц)', 'combined', 1, NULL, 150.00, 150.00, 'Неограниченное посещение тренажерного зала и групповых тренировок на 1 месяц'),
('Безлимит общий (3 месяца)', 'combined', 3, NULL, 400.00, 400.00, 'Неограниченное посещение тренажерного зала и групповых тренировок на 3 месяца'),
('Безлимит общий (6 месяцев)', 'combined', 6, NULL, 750.00, 750.00, 'Неограниченное посещение тренажерного зала и групповых тренировок на 6 месяцев'),
('Безлимит общий (12 месяцев)', 'combined', 12, NULL, 1400.00, 1400.00, 'Неограниченное посещение тренажерного зала и групповых тренировок на 12 месяцев');

INSERT INTO trainer_programs (trainer_id, name, description, price_per_session, duration_minutes) VALUES
(2, 'Силовая тренировка', 'Интенсивная силовая тренировка для развития мышечной массы', 25.00, 60),
(2, 'Функциональный тренинг', 'Упражнения для развития выносливости и функциональной силы', 20.00, 45),
(3, 'Йога для начинающих', 'Базовые асаны и дыхательные практики', 30.00, 60),
(3, 'Продвинутая йога', 'Сложные асаны и медитативные практики', 35.00, 75),
(4, 'Кардио-интервалы', 'Высокоинтенсивные интервальные тренировки', 22.00, 50),
(4, 'Кроссфит', 'Комплексные функциональные движения', 28.00, 60);

INSERT INTO schedule (trainer_id, program_id, session_type, session_date, start_time, end_time, max_participants) VALUES
(2, 1, 'individual', '2025-11-10', '09:00:00', '10:00:00', 1),
(3, 3, 'group', '2025-11-10', '10:00:00', '11:00:00', 15),
(4, 5, 'individual', '2025-11-10', '14:00:00', '14:50:00', 1),
(2, 2, 'group', '2025-11-10', '16:00:00', '16:45:00', 8),
(3, 4, 'individual', '2025-11-10', '18:00:00', '19:15:00', 1),

(4, 6, 'group', '2025-11-11', '09:00:00', '10:00:00', 12),
(2, 1, 'individual', '2025-11-11', '11:00:00', '12:00:00', 1),
(3, 3, 'group', '2025-11-11', '15:00:00', '16:00:00', 15),
(4, 5, 'individual', '2025-11-11', '17:00:00', '17:50:00', 1),
(2, 2, 'group', '2025-11-11', '19:00:00', '19:45:00', 8),

(3, 4, 'individual', '2025-11-12', '10:00:00', '11:15:00', 1),
(4, 6, 'group', '2025-11-12', '12:00:00', '13:00:00', 12),
(2, 1, 'individual', '2025-11-12', '14:00:00', '15:00:00', 1),
(3, 3, 'group', '2025-11-12', '16:00:00', '17:00:00', 15),
(4, 5, 'individual', '2025-11-12', '18:00:00', '18:50:00', 1),

(2, 2, 'group', '2025-11-13', '09:00:00', '09:45:00', 8),
(3, 4, 'individual', '2025-11-13', '11:00:00', '12:15:00', 1),
(4, 6, 'group', '2025-11-13', '13:00:00', '14:00:00', 12),
(2, 1, 'individual', '2025-11-13', '15:00:00', '16:00:00', 1),
(3, 3, 'group', '2025-11-13', '17:00:00', '18:00:00', 15),

(4, 5, 'individual', '2025-11-14', '10:00:00', '10:50:00', 1),
(2, 2, 'group', '2025-11-14', '12:00:00', '12:45:00', 8),
(3, 4, 'individual', '2025-11-14', '14:00:00', '15:15:00', 1),
(4, 6, 'group', '2025-11-14', '16:00:00', '17:00:00', 12),
(2, 1, 'individual', '2025-11-14', '18:00:00', '19:00:00', 1),

(3, 3, 'group', '2025-11-15', '09:00:00', '10:00:00', 15),
(4, 5, 'individual', '2025-11-15', '11:00:00', '11:50:00', 1),
(2, 2, 'group', '2025-11-15', '13:00:00', '13:45:00', 8),
(3, 4, 'individual', '2025-11-15', '15:00:00', '16:15:00', 1),

(4, 6, 'group', '2025-11-16', '10:00:00', '11:00:00', 12),
(2, 1, 'individual', '2025-11-16', '12:00:00', '13:00:00', 1),
(3, 3, 'group', '2025-11-16', '14:00:00', '15:00:00', 15),
(4, 5, 'individual', '2025-11-16', '16:00:00', '16:50:00', 1);

INSERT INTO subscriptions (user_id, type_id, start_date, end_date, visits_remaining) VALUES
(5, 1, '2025-11-10', '2025-12-10', NULL),
(6, 9, '2025-11-10', '2026-11-10', 4);

INSERT INTO bookings (user_id, schedule_id, with_trainer, status) VALUES
(5, 1, TRUE, 'booked'),
(6, 6, FALSE, 'booked');

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_trainer_profiles_trainer_id ON trainer_profiles(trainer_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX idx_schedule_date ON schedule(session_date);
CREATE INDEX idx_schedule_trainer ON schedule(trainer_id);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_schedule ON bookings(schedule_id);