-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Apr 21, 2026 at 05:24 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `recipedb`
--

-- --------------------------------------------------------

--
-- Table structure for table `compound_ingredient_details`
--

CREATE TABLE `compound_ingredient_details` (
  `node_id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cuisine_details`
--

CREATE TABLE `cuisine_details` (
  `node_id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `edge`
--

CREATE TABLE `edge` (
  `edge_id` int(11) NOT NULL,
  `source_id` int(11) NOT NULL,
  `target_id` int(11) NOT NULL,
  `edge_type` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `edge_backup`
--

CREATE TABLE `edge_backup` (
  `edge_id` int(11) NOT NULL DEFAULT 0,
  `source_id` int(11) NOT NULL,
  `target_id` int(11) NOT NULL,
  `edge_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `edge_graph_map`
--

CREATE TABLE `edge_graph_map` (
  `edge_id` int(11) NOT NULL,
  `graph_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `graph`
--

CREATE TABLE `graph` (
  `graph_id` int(11) NOT NULL,
  `graph_name` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ingredient_details`
--

CREATE TABLE `ingredient_details` (
  `node_id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `node`
--

CREATE TABLE `node` (
  `node_id` int(11) NOT NULL,
  `node_type` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `node_backup`
--

CREATE TABLE `node_backup` (
  `node_id` int(11) NOT NULL DEFAULT 0,
  `node_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `node_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `node_graph_map`
--

CREATE TABLE `node_graph_map` (
  `node_id` int(11) NOT NULL,
  `graph_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `recipe_details`
--

CREATE TABLE `recipe_details` (
  `node_id` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `compound_ingredient_details`
--
ALTER TABLE `compound_ingredient_details`
  ADD PRIMARY KEY (`node_id`);

--
-- Indexes for table `cuisine_details`
--
ALTER TABLE `cuisine_details`
  ADD PRIMARY KEY (`node_id`);

--
-- Indexes for table `edge`
--
ALTER TABLE `edge`
  ADD PRIMARY KEY (`edge_id`),
  ADD KEY `source_id` (`source_id`),
  ADD KEY `target_id` (`target_id`);

--
-- Indexes for table `edge_graph_map`
--
ALTER TABLE `edge_graph_map`
  ADD PRIMARY KEY (`edge_id`,`graph_id`),
  ADD KEY `graph_id` (`graph_id`);

--
-- Indexes for table `graph`
--
ALTER TABLE `graph`
  ADD PRIMARY KEY (`graph_id`);

--
-- Indexes for table `ingredient_details`
--
ALTER TABLE `ingredient_details`
  ADD PRIMARY KEY (`node_id`);

--
-- Indexes for table `node`
--
ALTER TABLE `node`
  ADD PRIMARY KEY (`node_id`),
  ADD KEY `node_type` (`node_type`);

--
-- Indexes for table `node_graph_map`
--
ALTER TABLE `node_graph_map`
  ADD PRIMARY KEY (`node_id`,`graph_id`),
  ADD KEY `graph_id` (`graph_id`);

--
-- Indexes for table `recipe_details`
--
ALTER TABLE `recipe_details`
  ADD PRIMARY KEY (`node_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `edge`
--
ALTER TABLE `edge`
  MODIFY `edge_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `graph`
--
ALTER TABLE `graph`
  MODIFY `graph_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `node`
--
ALTER TABLE `node`
  MODIFY `node_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `compound_ingredient_details`
--
ALTER TABLE `compound_ingredient_details`
  ADD CONSTRAINT `compound_ingredient_details_ibfk_1` FOREIGN KEY (`node_id`) REFERENCES `node` (`node_id`);

--
-- Constraints for table `cuisine_details`
--
ALTER TABLE `cuisine_details`
  ADD CONSTRAINT `cuisine_details_ibfk_1` FOREIGN KEY (`node_id`) REFERENCES `node` (`node_id`);

--
-- Constraints for table `edge`
--
ALTER TABLE `edge`
  ADD CONSTRAINT `1` FOREIGN KEY (`source_id`) REFERENCES `node` (`node_id`),
  ADD CONSTRAINT `2` FOREIGN KEY (`target_id`) REFERENCES `node` (`node_id`);

--
-- Constraints for table `edge_graph_map`
--
ALTER TABLE `edge_graph_map`
  ADD CONSTRAINT `edge_graph_map_ibfk_1` FOREIGN KEY (`edge_id`) REFERENCES `edge` (`edge_id`),
  ADD CONSTRAINT `edge_graph_map_ibfk_2` FOREIGN KEY (`graph_id`) REFERENCES `graph` (`graph_id`);

--
-- Constraints for table `ingredient_details`
--
ALTER TABLE `ingredient_details`
  ADD CONSTRAINT `ingredient_details_ibfk_1` FOREIGN KEY (`node_id`) REFERENCES `node` (`node_id`);

--
-- Constraints for table `node_graph_map`
--
ALTER TABLE `node_graph_map`
  ADD CONSTRAINT `node_graph_map_ibfk_1` FOREIGN KEY (`node_id`) REFERENCES `node` (`node_id`),
  ADD CONSTRAINT `node_graph_map_ibfk_2` FOREIGN KEY (`graph_id`) REFERENCES `graph` (`graph_id`);

--
-- Constraints for table `recipe_details`
--
ALTER TABLE `recipe_details`
  ADD CONSTRAINT `recipe_details_ibfk_1` FOREIGN KEY (`node_id`) REFERENCES `node` (`node_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
