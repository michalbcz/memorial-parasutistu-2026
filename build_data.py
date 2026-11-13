#!/usr/bin/env python3
"""
Generator dat pro interaktivní analýzu Memoriálu československých parašutistů 2026.
Vytvoří data.js a vysledky_2026.csv z kompletních 409 řádků oficiální výsledkové listiny.
"""

import csv
import json
import math
import statistics
from pathlib import Path

WAVE_SCHEDULE = [
    ("Alpha", "8:15"),
    ("Bravo", "8:30"),
    ("Charlie", "8:45"),
    ("Delta", "9:00"),
    ("Echo", "9:15"),
    ("Foxtrot", "9:30"),
    ("Golf", "9:45"),
    ("Hotel", "10:00"),
    ("India", "10:15"),
    ("Juliet", "10:30"),
    ("Kilo", "10:45"),
    ("Lima", "11:00"),
    ("Mike", "11:15"),
    ("November", "11:30"),
    ("Oscar", "11:45"),
    ("Papa", "12:00"),
    ("Quebec", "12:15"),
    ("Romeo", "12:30"),
    ("Siera", "12:45"),
    ("Tango", "13:00"),
    ("Uniform", "13:15"),
    ("Victor", "13:30"),
    ("Whisky", "13:45"),
    ("X-Ray", "14:00"),
    ("Yenkee", "14:15"),
    ("Zulu", "14:30"),
]

WAVE_MAP = dict(WAVE_SCHEDULE)

# Kompletních 409 řádků z Vysledkova_listina_2026.pdf (strany 1-13)
# Formát: (id, wave, start_str, name, status, arrival_str, total_str)
RAW_ROWS = [
    (1, "Alpha", "8:15", "eLKo", "a", "0:37", "16:22"),
    (2, "Alpha", "8:15", "SPARTA II", "a", "2:16", "18:01"),
    (3, "Alpha", "8:15", "Bábovky", "a", "22:52", "14:37"),
    (4, "Alpha", "8:15", "Sázavští zubři", "a", "21:07", "12:52"),
    (5, "Alpha", "8:15", "Božani", "a", "4:32", "20:17"),
    (6, "Alpha", "8:15", "Jsme Češi, nikdy se nevzdáme!", "a", "4:28", "20:13"),
    (7, "Alpha", "8:15", "V týmu je síla", "a", "0:59", "16:44"),
    (8, "Alpha", "8:15", "Perutýni", "a", "1:51", "17:36"),
    (9, "Alpha", "8:15", "Airborn Recruitements", "a", "0:24", "16:09"),
    (10, "Alpha", "8:15", "Nerudní chodci", "a", "0:24", "16:09"),
    (11, "Alpha", "8:15", "Druhá noha", "a", "4:57", "20:42"),
    (12, "Alpha", "8:15", "Bůček", "a", "22:52", "14:37"),
    (13, "Alpha", "8:15", "Do pekla a zpět", "a", "4:31", "20:16"),
    (14, "Alpha", "8:15", "Team dream", "a", "4:13", "19:58"),
    (15, "Alpha", "8:15", "AZ111", "a", "22:45", "14:30"),
    (16, "Alpha", "8:15", "Výzva 43/1", "a", "1:42", "17:27"),
    (17, "Bravo", "8:30", "Drtikol", "a", "23:42", "15:12"),
    (18, "Bravo", "8:30", "Pohodáři", "a", "1:30", "17:00"),
    (19, "Bravo", "8:30", "V utajení", "a", "23:06", "14:36"),
    (20, "Bravo", "8:30", "Iridium", "a", "1:21", "16:51"),
    (21, "Bravo", "8:30", "Jdeme na to", "a", "0:53", "16:23"),
    (22, "Bravo", "8:30", "Nějak to dáme", "a", "0:59", "16:29"),
    (23, "Bravo", "8:30", "AdRo", "a", "22:28", "13:58"),
    (24, "Bravo", "8:30", "MaPe", "a", "22:25", "13:55"),
    (25, "Bravo", "8:30", "Němčičáci", "a", "1:13", "16:43"),
    (26, "Bravo", "8:30", "XYZ", "a", "1:07", "16:37"),
    (27, "Bravo", "8:30", "CMDS", "n", "", ""),
    (28, "Bravo", "8:30", "Společenstvo Rychlých Nohou", "a", "2:25", "17:55"),
    (29, "Bravo", "8:30", "Daddies on the road", "a", "22:12", "13:42"),
    (30, "Bravo", "8:30", "Vitanna", "a", "0:16", "15:46"),
    (31, "Bravo", "8:30", "Klub anonymních alkoholiků", "a", "1:12", "16:42"),
    (32, "Bravo", "8:30", "Výzva 43/2", "a", "1:38", "17:08"),
    (33, "Charlie", "8:45", "Air Force One", "x", "", ""),
    (34, "Charlie", "8:45", "Divocí vlci I", "a", "2:13", "17:28"),
    (35, "Charlie", "8:45", "Svídnický extrém", "a", "0:05", "15:20"),
    (36, "Charlie", "8:45", "AZ111", "a", "2:19", "17:34"),
    (37, "Charlie", "8:45", "Jizera", "a", "3:59", "19:14"),
    (38, "Charlie", "8:45", "ENDURANCE", "a", "3:33", "18:48"),
    (39, "Charlie", "8:45", "Nechťak horo team", "a", "22:13", "13:28"),
    (40, "Charlie", "8:45", "NVZ 71", "a", "23:42", "14:57"),
    (41, "Charlie", "8:45", "Krvavé paty", "a", "4:34", "19:49"),
    (42, "Charlie", "8:45", "Okouni 70", "a", "2:06", "17:21"),
    (43, "Charlie", "8:45", "BOŽSKÉ SOWY", "a", "3:34", "18:49"),
    (44, "Charlie", "8:45", "ALCHYMISTI", "x", "", ""),
    (45, "Charlie", "8:45", "ALCHYMISTI 2", "x", "", ""),
    (46, "Charlie", "8:45", "Divocí vlci II", "a", "2:13", "17:28"),
    (47, "Charlie", "8:45", "Divocí vlci III", "a", "2:12", "17:27"),
    (48, "Charlie", "8:45", "Výzva 43/3", "a", "1:36", "16:51"),
    (49, "Delta", "9:00", "Sebranka", "a", "1:31", "16:31"),
    (50, "Delta", "9:00", "AZ Praha", "a", "0:30", "15:30"),
    (51, "Delta", "9:00", "Dorostenky", "a", "3:47", "18:47"),
    (52, "Delta", "9:00", "BERNY & SFEG", "a", "1:43", "16:43"),
    (53, "Delta", "9:00", "May the pork be with you", "a", "3:05", "18:05"),
    (54, "Delta", "9:00", "VamBik", "a", "3:05", "18:05"),
    (55, "Delta", "9:00", "Vládci vesmíru", "a", "1:45", "16:45"),
    (56, "Delta", "9:00", "Beránci", "a", "3:48", "18:48"),
    (57, "Delta", "9:00", "Hrobáci", "a", "1:30", "16:30"),
    (58, "Delta", "9:00", "Jezinky", "a", "2:18", "17:18"),
    (59, "Delta", "9:00", "Sešlost", "a", "2:18", "17:18"),
    (60, "Delta", "9:00", "Felčaři", "a", "2:41", "17:41"),
    (61, "Delta", "9:00", "Justice’s not dead", "a", "1:46", "16:46"),
    (62, "Delta", "9:00", "Marná snaha", "a", "1:17", "16:17"),
    (63, "Delta", "9:00", "Konťáci na Hrob", "x", "", ""),
    (64, "Delta", "9:00", "Výzva 43/4", "n", "", ""),
    (65, "Echo", "9:15", "Poupata III.", "a", "2:42", "17:27"),
    (66, "Echo", "9:15", "Blobíci", "a", "23:39", "14:24"),
    (67, "Echo", "9:15", "Cepníci 1", "a", "2:37", "17:22"),
    (68, "Echo", "9:15", "Wandráci Chrudim B", "x", "", ""),
    (69, "Echo", "9:15", "Wandráci Chrudim A", "x", "", ""),
    (70, "Echo", "9:15", "Foxtrot", "a", "1:11", "15:56"),
    (71, "Echo", "9:15", "Abrzlo", "n", "", ""),
    (72, "Echo", "9:15", "Cepníci 2", "a", "2:37", "17:22"),
    (73, "Echo", "9:15", "Modří sloni", "x", "", ""),
    (74, "Echo", "9:15", "Operace puchýř", "a", "1:36", "16:21"),
    (75, "Echo", "9:15", "HZS CR", "a", "2:25", "17:10"),
    (76, "Echo", "9:15", "Svorka 200", "a", "4:11", "18:56"),
    (77, "Echo", "9:15", "Vlasti zdar", "x", "", ""),
    (78, "Echo", "9:15", "LINTSE", "x", "", ""),
    (79, "Echo", "9:15", "Sparta", "a", "22:52", "13:37"),
    (80, "Echo", "9:00", "Výzva 43/5", "a", "6:46", "21:46"),
    (81, "Foxtrot", "9:30", "Nepál A", "a", "3:43", "18:13"),
    (82, "Foxtrot", "9:30", "Zatím dobrý", "a", "23:48", "14:18"),
    (83, "Foxtrot", "9:30", "Nepál B", "a", "3:43", "18:13"),
    (84, "Foxtrot", "9:30", "Zmrzlináři", "a", "5:26", "19:56"),
    (85, "Foxtrot", "9:30", "Raven", "a", "3:06", "17:36"),
    (86, "Foxtrot", "9:30", "Légion de Javorník", "a", "3:00", "17:30"),
    (87, "Foxtrot", "9:30", "Zahradníci", "x", "", ""),
    (88, "Foxtrot", "9:30", "Sestřenice na tahu", "a", "3:40", "18:10"),
    (89, "Foxtrot", "9:30", "Bratři sobě", "a", "2:45", "17:15"),
    (90, "Foxtrot", "9:30", "Dvouletky", "a", "2:44", "17:14"),
    (91, "Foxtrot", "9:30", "2/2 USMC", "a", "3:00", "17:30"),
    (92, "Foxtrot", "9:30", "71ProRob26", "a", "4:26", "18:56"),
    (93, "Foxtrot", "9:30", "Mara a Honza", "x", "", ""),
    (94, "Foxtrot", "9:30", "S.T.A.F.", "a", "7:43", "22:13"),
    (95, "Foxtrot", "9:30", "Kachna a Kočka", "n", "", ""),
    (96, "Foxtrot", "9:15", "Výzva 43/6", "x", "", ""),
    (97, "Golf", "9:45", "Bobíci", "a", "4:17", "18:32"),
    (98, "Golf", "9:45", "A-Team", "a", "3:18", "17:33"),
    (99, "Golf", "9:45", "OšOš", "a", "4:26", "18:41"),
    (100, "Golf", "9:45", "Pochoďáci", "a", "5:50", "20:05"),
    (101, "Golf", "9:45", "Přažská S", "a", "4:16", "18:31"),
    (102, "Golf", "9:45", "Scratch`N`blister", "a", "2:02", "16:17"),
    (103, "Golf", "9:45", "Vazouni", "a", "1:37", "15:52"),
    (104, "Golf", "9:45", "Cedo nulli", "x", "", ""),
    (105, "Golf", "9:45", "Přistáli vedle", "a", "3:41", "17:56"),
    (106, "Golf", "9:45", "Nosiči Lodí", "x", "", ""),
    (107, "Golf", "9:45", "Dva Důlci", "a", "5:51", "20:06"),
    (108, "Golf", "11:15", "Může za to Bára!", "x", "", ""),
    (109, "Golf", "9:15", "Talcum", "a", "2:36", "17:21"),
    (110, "Golf", "9:45", "Kelpie", "n", "", ""),
    (111, "Golf", "9:45", "WookieeClan", "x", "", ""),
    (112, "Golf", "9:30", "Výzva 43/7", "a", "1:44", "16:14"),
    (113, "Hotel", "10:00", "Gasbaits", "a", "1:42", "15:42"),
    (114, "Hotel", "10:00", "Screaming Eagles", "a", "1:52", "15:52"),
    (115, "Hotel", "10:00", "Jurenovi", "a", "23:26", "13:26"),
    (116, "Hotel", "10:00", "CARPE DIEM", "a", "3:13", "17:13"),
    (117, "Hotel", "10:00", "Zelenáči", "a", "5:22", "19:22"),
    (118, "Hotel", "10:00", "Gruntky", "a", "1:45", "15:45"),
    (119, "Hotel", "10:15", "Picklesové", "x", "", ""),
    (120, "Hotel", "10:15", "Záhoráčka a Čech", "a", "4:55", "18:40"),
    (121, "Hotel", "10:00", "Hotel Pod Širákem", "a", "1:08", "15:08"),
    (122, "Hotel", "10:00", "Kulišáci", "a", "3:08", "17:08"),
    (123, "Hotel", "10:00", "Zoufalci", "a", "23:26", "13:26"),
    (124, "Hotel", "10:00", "Chodci 1", "a", "3:29", "17:29"),
    (125, "Hotel", "10:00", "Vozíčkáři", "a", "3:31", "17:31"),
    (126, "Hotel", "10:00", "Silver K", "n", "", ""),
    (127, "Hotel", "10:00", "HC Hvězda Praha", "a", "2:43", "16:43"),
    (128, "Hotel", "9:45", "Výzva 43/8", "a", "3:28", "17:43"),
    (129, "India", "10:15", "Zuza a Kuba", "a", "23:29", "13:14"),
    (130, "India", "10:15", "Chodci z Ostré", "a", "4:30", "18:15"),
    (131, "India", "10:15", "Spem retine", "a", "5:50", "19:35"),
    (132, "India", "10:15", "Bobánci", "x", "", ""),
    (133, "India", "10:15", "Dandi team", "x", "", ""),
    (134, "India", "10:15", "Prosecco team", "a", "4:29", "18:14"),
    (135, "India", "10:15", "Rajdy z Pardubic", "a", "3:01", "16:46"),
    (136, "India", "10:15", "Zarostlý palce", "a", "3:01", "16:46"),
    (137, "India", "10:15", "vandrvol", "a", "3:14", "16:59"),
    (138, "India", "10:00", "Rohlíci", "a", "3:28", "17:28"),
    (139, "India", "10:15", "J&A", "a", "3:44", "17:29"),
    (140, "India", "10:15", "OFF.line", "x", "", ""),
    (141, "India", "10:15", "Michda", "n", "", ""),
    (142, "India", "10:15", "Klubisté", "a", "1:53", "15:38"),
    (143, "India", "10:15", "Štramák a hřebík", "a", "0:45", "14:30"),
    (144, "India", "10:00", "Výzva 43/9", "a", "4:08", "18:08"),
    (145, "Juliet", "10:30", "Jan a Jan", "a", "4:24", "17:54"),
    (146, "Juliet", "10:30", "Telmont team", "a", "2:07", "15:37"),
    (147, "Juliet", "10:30", "HASIČI CHRUDIM I", "a", "2:25", "15:55"),
    (148, "Juliet", "10:30", "Orelská Elita 3", "a", "2:14", "15:44"),
    (149, "Juliet", "10:30", "Němci", "a", "3:54", "17:24"),
    (150, "Juliet", "10:30", "Flohbande", "a", "4:03", "17:33"),
    (151, "Juliet", "10:30", "Pepka", "a", "3:33", "17:03"),
    (152, "Juliet", "10:30", "OBC Alpha", "n", "", ""),
    (153, "Juliet", "10:30", "OBC Helehotel", "a", "6:43", "20:13"),
    (154, "Juliet", "10:30", "Orelská Elita 1", "a", "2:26", "15:56"),
    (155, "Juliet", "10:30", "Vertikálně retaedovaný", "n", "", ""),
    (156, "Juliet", "10:30", "Dívčí komando", "a", "1:57", "15:27"),
    (157, "Juliet", "10:30", "Orelská Elita 2", "a", "2:03", "15:33"),
    (158, "Juliet", "10:30", "Řepáci", "x", "", ""),
    (159, "Juliet", "10:30", "Krakonošovi velvyslanci", "a", "5:21", "18:51"),
    (160, "Juliet", "10:30", "Dva na trase, jeden z vlastní vůle", "a", "2:24", "15:54"),
    (161, "Kilo", "10:45", "Jedouchov TEAM", "a", "1:45", "15:00"),
    (162, "Kilo", "10:45", "Turbo Slimáci", "a", "4:29", "17:44"),
    (163, "Kilo", "10:45", "Tím Poslednej Chvíle", "a", "4:34", "17:49"),
    (164, "Kilo", "10:45", "Potom Sa Natiahneme", "a", "5:01", "18:16"),
    (165, "Kilo", "10:45", "Malikán", "a", "2:40", "15:55"),
    (166, "Kilo", "10:45", "Rýchli a Zmätení", "a", "4:31", "17:46"),
    (167, "Kilo", "10:45", "Dáme To Nejako", "x", "", ""),
    (168, "Kilo", "10:45", "Víťazi Morálky", "a", "4:30", "17:45"),
    (169, "Kilo", "10:45", "Kostíci", "a", "5:52", "19:07"),
    (170, "Kilo", "10:45", "Pomalý Fretky", "n", "", ""),
    (171, "Kilo", "10:45", "Dva Kohouti", "a", "3:48", "17:03"),
    (172, "Kilo", "10:45", "Legendy Rozcvičky", "a", "4:36", "17:51"),
    (173, "Kilo", "10:45", "Rýchlosť Nie Je Všetko", "a", "5:02", "18:17"),
    (174, "Kilo", "10:45", "Grusáci", "a", "5:55", "19:10"),
    (175, "Kilo", "10:45", "Rubíni", "x", "", ""),
    (176, "Lima", "11:00", "Tlapkova patrola", "a", "2:05", "15:05"),
    (177, "Lima", "11:00", "Filija", "a", "4:46", "17:46"),
    (178, "Lima", "11:00", "Division Werner", "a", "4:46", "17:46"),
    (179, "Lima", "11:00", "DOUBLE", "a", "3:51", "16:51"),
    (180, "Lima", "9:15", "JaLu", "a", "22:03", "12:48"),
    (181, "Lima", "11:00", "Ještě vymyslíme", "a", "4:48", "17:48"),
    (182, "Lima", "11:00", "Dolomiťáci", "a", "23:34", "12:34"),
    (183, "Lima", "11:00", "Tunelteam", "a", "2:54", "15:54"),
    (184, "Lima", "11:00", "Kávičkárky", "x", "", ""),
    (185, "Lima", "11:00", "Platypus", "x", "", ""),
    (186, "Lima", "11:00", "Statici", "n", "", ""),
    (187, "Lima", "11:00", "Statici junior", "a", "3:50", "16:50"),
    (188, "Lima", "11:00", "Anonymní šachisté", "a", "2:39", "15:39"),
    (189, "Lima", "11:00", "Brambory", "a", "2:38", "15:38"),
    (190, "Lima", "11:00", "Kobliháři", "x", "", ""),
    (191, "Lima", "11:00", "CZE/US 1", "a", "3:26", "16:26"),
    (192, "Lima", "11:00", "CZE/US 2", "a", "3:26", "16:26"),
    (193, "Mike", "11:15", "Náhodní kolemjdoucí", "a", "5:31", "18:16"),
    (194, "Mike", "11:15", "Shrimps on a mission", "a", "4:02", "16:47"),
    (195, "Mike", "11:15", "Už teď nemůžeme", "a", "5:33", "18:18"),
    (196, "Mike", "11:15", "A Team + 1/2 Horalky", "a", "22:39", "11:24"),
    (197, "Mike", "11:15", "WANDERER", "a", "1:20", "14:05"),
    (198, "Mike", "11:15", "Engine", "x", "", ""),
    (199, "Mike", "11:15", "Skupina A", "a", "3:49", "16:34"),
    (200, "Mike", "11:15", "Skupina B", "a", "3:49", "16:34"),
    (201, "Mike", "11:15", "Bratranec a sestřenice", "a", "4:35", "17:20"),
    (202, "Mike", "11:15", "Dva veteráni", "a", "4:35", "17:20"),
    (203, "Mike", "11:15", "Sestry v akci", "n", "", ""),
    (204, "Mike", "11:30", "Easy Company", "x", "", ""),
    (205, "Mike", "11:15", "Expendables", "a", "4:53", "17:38"),
    (206, "Mike", "11:15", "Sešlapané podrážky", "a", "1:16", "14:01"),
    (207, "Mike", "11:15", "Jenkys a Jéža", "a", "4:23", "17:08"),
    (208, "Mike", "11:00", "CZE/US 3", "a", "3:27", "16:27"),
    (209, "Mike", "11:00", "CZE/US 4", "a", "3:27", "16:27"),
    (210, "November", "11:30", "KVP", "a", "5:16", "17:46"),
    (211, "November", "11:30", "Nazdar!", "a", "5:13", "17:43"),
    (212, "November", "11:30", "Smrkac", "x", "", ""),
    (213, "November", "11:30", "PelDol", "a", "5:37", "18:07"),
    (214, "November", "11:30", "Klapkateam", "a", "5:20", "17:50"),
    (215, "November", "11:30", "Po(c)hodáři", "a", "5:46", "18:16"),
    (216, "November", "11:30", "Glokva", "a", "5:05", "17:35"),
    (217, "November", "11:45", "Kojoti", "a", "4:59", "17:14"),
    (218, "November", "11:30", "Bohemians", "a", "6:25", "18:55"),
    (219, "November", "11:30", "Pozdrav z Líní", "a", "4:18", "16:48"),
    (220, "November", "11:30", "Veselý klín", "n", "", ""),
    (221, "November", "11:30", "Rychlá rota", "n", "", ""),
    (222, "November", "11:45", "Charlieho andílci", "x", "", ""),
    (223, "November", "11:30", "Ostřešany", "a", "5:27", "17:57"),
    (224, "November", "11:30", "Band of Heros", "x", "", ""),
    (225, "November", "11:30", "", "", "", ""),
    (226, "Oscar", "11:45", "Jojoba", "a", "6:13", "18:28"),
    (227, "Oscar", "10:00", "K - Ladies", "a", "4:21", "18:21"),
    (228, "Oscar", "11:45", "Puchýřová brigáda", "a", "5:34", "17:49"),
    (229, "Oscar", "11:45", "Loupežníci z Palmovky", "a", "3:32", "15:47"),
    (230, "Oscar", "9:00", "Keepfalling", "a", "23:50", "14:50"),
    (231, "Oscar", "11:45", "Neumime se rozhodnout", "n", "", ""),
    (232, "Oscar", "12:30", "Drtivá porážka", "a", "6:10", "17:40"),
    (233, "Oscar", "11:45", "Mallorcan dream", "a", "5:29", "17:44"),
    (234, "Oscar", "11:45", "Praví loupežníci z Palmovky", "a", "3:21", "15:36"),
    (235, "Oscar", "11:45", "Nenuška", "a", "5:18", "17:33"),
    (236, "Oscar", "11:45", "Paradesantní vyšetřování", "a", "3:35", "15:50"),
    (237, "Oscar", "11:45", "Želvoteam", "a", "5:16", "17:31"),
    (238, "Oscar", "11:45", "Želvoteam junior", "a", "4:20", "16:35"),
    (239, "Oscar", "11:45", "Easy Team", "x", "", ""),
    (240, "Oscar", "11:45", "Podpora loupežníků z Palmovky", "a", "3:20", "15:35"),
    (241, "Oscar", "11:15", "Pozlerovci", "x", "", ""),
    (242, "Papa", "12:00", "Chaos", "x", "", ""),
    (243, "Papa", "12:00", "Death Korps", "a", "4:10", "16:10"),
    (244, "Papa", "12:00", "SVK13", "a", "5:47", "17:47"),
    (245, "Papa", "12:00", "Dlouhý a široký", "a", "4:20", "16:20"),
    (246, "Papa", "12:00", "Nomad Society", "a", "8:15", "20:15"),
    (247, "Papa", "12:00", "Mlátičky", "a", "6:26", "18:26"),
    (248, "Papa", "12:00", "Alfa squadra tým dynamickejch čuprstár sekáčskejch vlkoušů", "n", "", ""),
    (249, "Papa", "12:00", "Toulavé mačičky", "x", "", ""),
    (250, "Papa", "12:00", "Vídeňský párci", "x", "", ""),
    (251, "Papa", "12:00", "The Big Micks", "x", "", ""),
    (252, "Papa", "12:00", "M&M", "x", "", ""),
    (253, "Papa", "12:00", "KLADIVA", "a", "5:44", "17:44"),
    (254, "Papa", "12:00", "chaos2", "x", "", ""),
    (255, "Papa", "12:00", "Hanební parchanti", "n", "", ""),
    (256, "Papa", "12:00", "Zrzavá hydra", "x", "", ""),
    (257, "Papa", "11:30", "Lucky Loosers", "a", "1:46", "14:16"),
    (258, "Quebec", "12:15", "Kamarádi na cestách", "a", "3:42", "15:27"),
    (259, "Quebec", "12:15", "bravo", "a", "7:08", "18:53"),
    (260, "Quebec", "12:15", "Wolfram", "a", "4:15", "16:00"),
    (261, "Quebec", "12:15", "", "", "", ""),
    (262, "Quebec", "12:15", "Bez tanku a psa", "n", "", ""),
    (263, "Quebec", "12:15", "Sokol 2", "a", "5:45", "17:30"),
    (264, "Quebec", "12:15", "Sokol 1", "a", "5:36", "17:21"),
    (265, "Quebec", "12:15", "Sokol 4", "x", "", ""),
    (266, "Quebec", "12:15", "Sokol 5", "a", "5:37", "17:22"),
    (267, "Quebec", "12:15", "FAJT", "a", "6:28", "18:13"),
    (268, "Quebec", "12:15", "Sokol 3", "a", "5:44", "17:29"),
    (269, "Quebec", "12:15", "Mouflons", "x", "", ""),
    (270, "Quebec", "12:15", "Správnej mindset", "a", "5:25", "17:10"),
    (271, "Quebec", "11:45", "Svatošky", "x", "", ""),
    (272, "Quebec", "12:15", "Sekecmazec", "a", "6:08", "17:53"),
    (273, "Romeo", "12:30", "2Lvi", "a", "5:54", "17:24"),
    (274, "Romeo", "12:30", "Hobo Base", "n", "", ""),
    (275, "Romeo", "12:30", "HOPE", "a", "5:23", "16:53"),
    (276, "Romeo", "12:30", "Archeologove", "x", "", ""),
    (277, "Romeo", "12:30", "Williams", "a", "7:01", "18:31"),
    (278, "Romeo", "12:30", "Čahouni", "a", "6:10", "17:40"),
    (279, "Romeo", "12:30", "Gang VerJa", "a", "5:18", "16:48"),
    (280, "Romeo", "12:30", "4WD", "a", "4:50", "16:20"),
    (281, "Romeo", "12:30", "Baterky", "a", "5:23", "16:53"),
    (282, "Romeo", "12:30", "Komando z Beranky", "a", "5:04", "16:34"),
    (283, "Romeo", "11:45", "Lovci omylů", "a", "5:30", "17:45"),
    (284, "Romeo", "12:30", "Uruz", "a", "6:06", "17:36"),
    (285, "Romeo", "12:30", "Zrádci", "n", "", ""),
    (286, "Romeo", "12:30", "Lesněnky", "a", "3:39", "15:09"),
    (287, "Romeo", "12:30", "Arditi", "a", "3:39", "15:09"),
    (288, "Siera", "12:45", "Argentum", "a", "4:55", "16:10"),
    (289, "Siera", "12:45", "Dva páni Štěpáni", "n", "", ""),
    (290, "Siera", "12:45", "Slunce 4", "a", "4:25", "15:40"),
    (291, "Siera", "12:45", "Double Trouble", "a", "4:32", "15:47"),
    (292, "Siera", "12:45", "StrŠkr", "a", "4:52", "16:07"),
    (293, "Siera", "14:15", "WOLFRAM ALFA", "a", "10:00", "19:45"),
    (294, "Siera", "12:45", "Košpok", "a", "0:20", "11:35"),
    (295, "Siera", "12:45", "plk. Josef František", "a", "5:57", "17:12"),
    (296, "Siera", "12:45", "Vlci", "a", "5:15", "16:30"),
    (297, "Siera", "12:45", "MorMaBa", "a", "3:53", "15:08"),
    (298, "Siera", "12:45", "Snad už to dnes vyjde", "x", "", ""),
    (299, "Siera", "12:45", "LIGHTNING AT THE GATES", "a", "6:42", "17:57"),
    (300, "Siera", "12:45", "Pekelně ostrý výlet", "a", "7:17", "18:32"),
    (301, "Siera", "12:45", "Las Velas", "a", "4:19", "15:34"),
    (302, "Siera", "12:45", "143. Skupina speciálních sil", "x", "", ""),
    (303, "Tango", "13:00", "Tým001", "a", "4:22", "15:22"),
    (304, "Tango", "13:00", "No Surrender", "a", "4:09", "15:09"),
    (305, "Tango", "13:00", "Krále nezlomíš", "a", "5:59", "16:59"),
    (306, "Tango", "11:30", "Může za to Bára II", "x", "", ""),
    (307, "Tango", "13:15", "Nezlomní", "x", "", ""),
    (308, "Tango", "13:00", "Fast & Last team", "n", "", ""),
    (309, "Tango", "13:00", "Silver B7", "a", "3:35", "14:35"),
    (310, "Tango", "13:15", "Po žních k Turkovi", "a", "2:33", "13:18"),
    (311, "Tango", "13:00", "MP v záloze", "a", "5:11", "16:11"),
    (312, "Tango", "13:00", "Tripsitters", "a", "6:17", "17:17"),
    (313, "Tango", "13:00", "MichMar", "a", "3:25", "14:25"),
    (314, "Tango", "13:00", "", "", "", ""),
    (315, "Tango", "13:00", "Východniarská Kavaléria", "x", "", ""),
    (316, "Tango", "13:00", "KmonDom", "a", "5:46", "16:46"),
    (317, "Tango", "13:00", "VP", "n", "", ""),
    (318, "Uniform", "13:00", "Tak jdem!", "a", "5:29", "16:29"),
    (319, "Uniform", "9:30", "Kanat", "a", "23:56", "14:26"),
    (320, "Uniform", "13:15", "", "", "", ""),
    (321, "Uniform", "13:15", "Axlova děvčata", "n", "", ""),
    (322, "Uniform", "13:15", "Chyba 404", "a", "6:34", "17:19"),
    (323, "Uniform", "13:15", "Dva zoufalci", "a", "6:33", "17:18"),
    (324, "Uniform", "13:15", "Jižní spojka", "a", "5:43", "16:28"),
    (325, "Uniform", "13:15", "11:11:00", "a", "7:54", "18:39"),
    (326, "Uniform", "13:15", "Slepá a slepější", "a", "4:36", "15:21"),
    (327, "Uniform", "13:15", "Juníci", "x", "", ""),
    (328, "Uniform", "13:15", "Gunnerside", "a", "4:58", "15:43"),
    (329, "Uniform", "12:00", "BTB 241", "x", "", ""),
    (330, "Uniform", "13:15", "Maverick", "n", "", ""),
    (331, "Uniform", "13:00", "Sranda team", "a", "7:09", "18:09"),
    (332, "Uniform", "13:15", "Nezávislé ženy", "a", "0:52", "11:37"),
    (333, "Victor", "13:30", "pepe.gif", "x", "", ""),
    (334, "Victor", "13:30", "Sosáci", "a", "5:34", "16:04"),
    (335, "Victor", "13:15", "UKL 59", "a", "6:40", "17:25"),
    (336, "Victor", "13:30", "Eagle", "a", "5:47", "16:17"),
    (337, "Victor", "13:30", "Štaflík a Špagetka", "n", "", ""),
    (338, "Victor", "13:30", "Bosani", "a", "5:11", "15:41"),
    (339, "Victor", "13:45", "Rakia squad", "x", "", ""),
    (340, "Victor", "13:30", "KVVV PRAHA - PATHFINDERS", "x", "", ""),
    (341, "Victor", "13:30", "KVVV PRAHA - PATHFINDERS II", "x", "", ""),
    (342, "Victor", "13:30", "Pedoni da Venezia", "n", "", ""),
    (343, "Victor", "13:30", "PATHFINDER II", "x", "", ""),
    (344, "Victor", "13:30", "Ochechule", "a", "0:27", "10:57"),
    (345, "Victor", "11:45", "Prosecco team", "a", "3:23", "15:38"),
    (346, "Victor", "13:30", "Vivat Christus Rex!", "n", "", ""),
    (347, "Victor", "13:15", "SEPO 224", "x", "3:42", "14:27"),
    (348, "Whisky", "13:30", "Jezevci", "a", "6:36", "17:06"),
    (349, "Whisky", "13:45", "Vzdát můžeš až zítra", "n", "", ""),
    (350, "Whisky", "8:30", "Tým Brno", "a", "1:34", "17:04"),
    (351, "Whisky", "13:45", "Gita Podivín", "a", "5:12", "15:27"),
    (352, "Whisky", "13:45", "Ladná", "a", "6:50", "17:05"),
    (353, "Whisky", "11:45", "Jelínkovci", "a", "3:52", "16:07"),
    (354, "Whisky", "13:45", "Myštifikátoři", "x", "", ""),
    (355, "Whisky", "13:00", "Noci v akci", "a", "5:14", "16:14"),
    (356, "Whisky", "13:45", "Dva špinavci", "a", "5:03", "15:18"),
    (357, "Whisky", "13:45", "Je právě sechs hodin", "a", "7:12", "17:27"),
    (358, "Whisky", "13:30", "Chybná souřadnice", "a", "6:35", "17:05"),
    (359, "Whisky", "13:45", "Srdcem a skalpelem", "n", "", ""),
    (360, "Whisky", "13:45", "Manětínská Kuncička", "n", "", ""),
    (361, "Whisky", "12:45", "MTFO", "a", "5:58", "17:13"),
    (362, "Whisky", "13:00", "Sračky", "x", "", ""),
    (363, "X-Ray", "13:45", "RPIMa", "a", "6:18", "16:33"),
    (364, "X-Ray", "14:00", "Čechoslováci", "a", "7:16", "17:16"),
    (365, "X-Ray", "14:00", "6XBVA", "a", "5:24", "15:24"),
    (366, "X-Ray", "14:00", "6XBVB", "a", "5:24", "15:24"),
    (367, "X-Ray", "9:00", "LIBOR", "a", "23:16", "14:16"),
    (368, "X-Ray", "14:00", "BOSNA98", "n", "", ""),
    (369, "X-Ray", "14:00", "CAF", "a", "6:27", "16:27"),
    (370, "X-Ray", "14:00", "Bhmlc", "x", "", ""),
    (371, "X-Ray", "14:00", "Umýt vezán", "x", "", ""),
    (372, "X-Ray", "14:00", "Atentátníci", "a", "7:29", "17:29"),
    (373, "X-Ray", "14:00", "2L2HELL", "x", "", ""),
    (374, "X-Ray", "13:45", "Dvojčata v ráži", "a", "3:34", "13:49"),
    (375, "X-Ray", "14:00", "Gumy", "n", "", ""),
    (376, "X-Ray", "14:00", "ACZ", "x", "", ""),
    (377, "X-Ray", "14:00", "SPCZ", "x", "", ""),
    (378, "Yenkee", "14:15", "Dukla", "a", "", ""),
    (379, "Yenkee", "14:15", "MentalAsylumEscapees", "a", "7:52", "17:37"),
    (380, "Yenkee", "14:15", "Fauda", "x", "", ""),
    (381, "Yenkee", "14:15", "Thorium", "x", "", ""),
    (382, "Yenkee", "14:15", "Ninjago", "a", "", ""),
    (383, "Yenkee", "14:15", "Výsadek 14:00", "x", "", ""),
    (384, "Yenkee", "14:15", "Čermáčci", "x", "", ""),
    (385, "Yenkee", "14:15", "Ironman", "n", "", ""),
    (386, "Yenkee", "14:15", "Mašek veteranos", "a", "7:07", "16:52"),
    (387, "Yenkee", "14:15", "Mollesisterhood", "x", "", ""),
    (388, "Yenkee", "14:15", "Mollesisterhood", "a", "7:13", "16:58"),
    (389, "Yenkee", "14:15", "Baumläufer", "a", "4:09", "13:54"),
    (390, "Yenkee", "14:15", "4 kandak", "a", "4:22", "14:07"),
    (391, "Yenkee", "14:15", "Autismus Prime", "a", "6:23", "16:08"),
    (392, "Yenkee", "14:15", "Hrušky", "x", "", ""),
    (393, "Zulu", "14:30", "Maru a Maru", "x", "", ""),
    (394, "Zulu", "14:30", "Andělé z nebes", "a", "7:45", "17:15"),
    (395, "Zulu", "14:30", "Green shith elite", "a", "7:30", "17:00"),
    (396, "Zulu", "14:15", "Turbo želvy", "a", "4:01", "13:46"),
    (397, "Zulu", "14:30", "Plán B", "x", "", ""),
    (398, "Zulu", "14:30", "Perutýn", "x", "", ""),
    (399, "Zulu", "14:30", "Beer Force", "a", "2:04", "11:34"),
    (400, "Zulu", "14:30", "Kremační psi", "n", "", ""),
    (401, "Zulu", "14:15", "PopEyes", "a", "7:43", "17:28"),
    (402, "Zulu", "14:00", "Chosniči", "x", "", ""),
    (403, "Zulu", "14:30", "Už jsme se ztratili?", "a", "6:38", "16:08"),
    (404, "Zulu", "14:15", "Farmari", "a", "3:06", "12:51"),
    (405, "Zulu", "14:30", "Fjury", "a", "7:53", "17:23"),
    (406, "Zulu", "14:30", "Černí draci", "x", "", ""),
    (407, "Zulu", "13:45", "Bleskový přesun", "a", "0:26", "10:41"),
    (408, "Zulu", "8:30", "ElLin", "a", "0:41", "16:11"),
    (409, "Zulu", "14:30", "Invalidi", "x", "", ""),
]

ROUTE_KM = 70.0
LIMIT_MINUTES = 18 * 60


def parse_hhmm(s: str):
    if not s:
        return None
    h, m = map(int, s.split(":"))
    return h * 60 + m


def format_pace(total_min: int) -> str:
    sec_per_km = (total_min * 60) / ROUTE_KM
    mins = int(sec_per_km // 60)
    secs = int(round(sec_per_km % 60))
    if secs == 60:
        mins += 1
        secs = 0
    return f"{mins}:{secs:02d}"


def build():
    assert len(RAW_ROWS) == 409, f"Expected 409 rows, got {len(RAW_ROWS)}"

    teams = []
    for idx, (num, wave, start_str, name, status, arr_str, total_str) in enumerate(RAW_ROWS, 1):
        assert idx == num, f"Row id mismatch at {idx} vs {num}"
        assert wave in WAVE_MAP, f"Unknown wave {wave}"

        sched_start_str = WAVE_MAP[wave]
        start_min = parse_hhmm(start_str)
        sched_start_min = parse_hhmm(sched_start_str)
        total_min = parse_hhmm(total_str)
        arr_min = parse_hhmm(arr_str)

        # Absolutní čas příchodu od sobotní půlnoci 00:00
        arr_abs = None
        if arr_min is not None and start_min is not None:
            # Příchod může být ve stejný den (Sobota, např. 21:07) nebo v Neděli (např. 0:26, 10:00)
            arr_abs = arr_min if arr_min >= start_min else arr_min + 1440
            # Konzistence: start_min + total_min == arr_abs
            if total_min is not None:
                assert start_min + total_min == arr_abs, (
                    f"Time mismatch #{num} {name}: {start_str} + {total_str} != {arr_str}"
                )

        is_unassigned = (name == "" and status == "")
        wave_jumper = (not is_unassigned) and (start_str != sched_start_str)

        speed_kmh = round(ROUTE_KM / (total_min / 60.0), 2) if total_min else None
        pace = format_pace(total_min) if total_min else None
        under_18h = (total_min <= LIMIT_MINUTES) if (status == "a" and total_min is not None) else None

        anomaly = None
        if status == "x" and total_min is not None:
            anomaly = "dnf_with_time"
        elif status == "a" and total_min is None:
            anomaly = "finisher_no_time"
        elif is_unassigned:
            anomaly = "unassigned"

        teams.append({
            "id": num,
            "wave": wave,
            "wave_scheduled_start": sched_start_str,
            "wave_scheduled_min": sched_start_min,
            "start": start_str,
            "start_min": start_min,
            "name": name if not is_unassigned else "(neobsazeno)",
            "is_unassigned": is_unassigned,
            "status": status if not is_unassigned else "u",
            "arrival": arr_str,
            "arrival_abs_min": arr_abs,
            "total": total_str,
            "total_min": total_min,
            "speed_kmh": speed_kmh,
            "pace_min_km": pace,
            "under_18h": under_18h,
            "wave_jumper": wave_jumper,
            "start_diff_min": (start_min - sched_start_min) if (start_min is not None and not is_unassigned) else 0,
            "anomaly": anomaly,
            "rank_overall": None,
            "rank_in_wave": None,
            "percentile": None,
        })

    # Počty podle statusu
    a_teams = [t for t in teams if t["status"] == "a"]
    x_teams = [t for t in teams if t["status"] == "x"]
    n_teams = [t for t in teams if t["status"] == "n"]
    u_teams = [t for t in teams if t["is_unassigned"]]

    assert len(a_teams) == 294, f"Expected 294 'a', got {len(a_teams)}"
    assert len(x_teams) == 76, f"Expected 76 'x', got {len(x_teams)}"
    assert len(n_teams) == 35, f"Expected 35 'n', got {len(n_teams)}"
    assert len(u_teams) == 4, f"Expected 4 unassigned, got {len(u_teams)}"

    timed_finishers = [t for t in a_teams if t["total_min"] is not None]
    assert len(timed_finishers) == 292, f"Expected 292 timed finishers, got {len(timed_finishers)}"

    # Celkové pořadí (standard competition ranking 1, 2, 2, 4...)
    sorted_finishers = sorted(timed_finishers, key=lambda t: (t["total_min"], t["id"]))
    last_time = None
    last_rank = 0
    for i, t in enumerate(sorted_finishers, 1):
        if t["total_min"] != last_time:
            last_rank = i
            last_time = t["total_min"]
        t["rank_overall"] = last_rank
        t["percentile"] = round(100.0 * (len(sorted_finishers) - i) / (len(sorted_finishers) - 1), 1)

    assert sorted_finishers[0]["id"] == 407 and sorted_finishers[0]["total"] == "10:41"
    assert sorted_finishers[1]["id"] == 344 and sorted_finishers[1]["total"] == "10:57"
    assert sorted_finishers[2]["id"] == 196 and sorted_finishers[2]["total"] == "11:24"

    def fmt_min(m):
        m_int = int(round(m))
        return f"{m_int // 60}:{m_int % 60:02d}"

    # Pořadí ve výsadku
    waves_stats = []
    for wave_name, sched in WAVE_SCHEDULE:
        w_all = [t for t in teams if t["wave"] == wave_name and not t["is_unassigned"]]
        w_a = [t for t in w_all if t["status"] == "a"]
        w_timed = sorted([t for t in w_a if t["total_min"] is not None], key=lambda t: (t["total_min"], t["id"]))
        w_last_t = None
        w_last_r = 0
        for i, t in enumerate(w_timed, 1):
            if t["total_min"] != w_last_t:
                w_last_r = i
                w_last_t = t["total_min"]
            t["rank_in_wave"] = w_last_r

        w_x = [t for t in w_all if t["status"] == "x"]
        w_n = [t for t in w_all if t["status"] == "n"]
        w_starters = len(w_a) + len(w_x)
        w_under_18 = [t for t in w_timed if t["under_18h"]]
        w_over_18 = [t for t in w_timed if not t["under_18h"]]
        w_times = [t["total_min"] for t in w_timed]
        w_med_min = round(statistics.median(w_times), 1) if w_times else None
        w_med_speed = round(ROUTE_KM / (w_med_min / 60.0), 2) if w_med_min else None

        waves_stats.append({
            "wave": wave_name,
            "scheduled_start": sched,
            "scheduled_min": parse_hhmm(sched),
            "registered": len(w_all),
            "started": w_starters,
            "finished": len(w_a),
            "finished_timed": len(w_timed),
            "under_18h": len(w_under_18),
            "over_18h": len(w_over_18),
            "dnf": len(w_x),
            "dns": len(w_n),
            "success_rate": round(100.0 * len(w_a) / w_starters, 1) if w_starters else 0.0,
            "avg_min": round(statistics.mean(w_times), 1) if w_times else None,
            "median_min": w_med_min,
            "median_str": fmt_min(w_med_min) if w_med_min else None,
            "median_speed_kmh": w_med_speed,
            "best_min": min(w_times) if w_times else None,
            "best_team_id": w_timed[0]["id"] if w_timed else None,
            "best_team_name": w_timed[0]["name"] if w_timed else None,
            "worst_min": max(w_times) if w_times else None,
            "jumpers": len([t for t in w_all if t["wave_jumper"]]),
        })

    all_times = [t["total_min"] for t in sorted_finishers]
    under_18_list = [t for t in sorted_finishers if t["under_18h"]]
    over_18_list = [t for t in sorted_finishers if not t["under_18h"]]
    avg_all = round(statistics.mean(all_times), 1)
    med_all = round(statistics.median(all_times), 1)

    summary = {
        "event_name": "Memoriál československých parašutistů 2026",
        "theme": "Tři králové – Pocta pplk. Josefu Mašínovi",
        "date": "7. 11. 2026",
        "distance_km": ROUTE_KM,
        "limit_hours": 18,
        "password": "SKOŘICE",
        "total_rows": len(teams),
        "assigned_teams": len(teams) - len(u_teams),
        "unassigned_slots": len(u_teams),
        "started": len(a_teams) + len(x_teams),  # 370
        "finished_total": len(a_teams),  # 294
        "finished_timed": len(timed_finishers),  # 292
        "finished_untimed": len(a_teams) - len(timed_finishers),  # 2
        "under_18h": len(under_18_list),  # 237
        "over_18h": len(over_18_list),  # 55
        "dnf": len(x_teams),  # 76
        "dns_named": len(n_teams),  # 35
        "dns_pdf_total": len(n_teams) + len(u_teams) + 1,  # 35 + 4 + row 410 = 40
        "success_rate_pct": round(100.0 * len(a_teams) / (len(a_teams) + len(x_teams)), 1),
        "success_rate_pdf_pct": 80,
        "avg_min": avg_all,
        "avg_str": fmt_min(avg_all),
        "avg_speed_kmh": round(ROUTE_KM / (avg_all / 60.0), 2),
        "median_min": med_all,
        "median_str": fmt_min(med_all),
        "median_speed_kmh": round(ROUTE_KM / (med_all / 60.0), 2),
        "median_pace_str": format_pace(int(round(med_all))),
        "fastest_min": sorted_finishers[0]["total_min"],
        "fastest_str": sorted_finishers[0]["total"],
        "slowest_min": sorted_finishers[-1]["total_min"],
        "slowest_str": sorted_finishers[-1]["total"],
        "wave_jumpers_count": len([t for t in teams if t["wave_jumper"]]),
        "total_km_finishers": int(len(a_teams) * 2 * ROUTE_KM),
    }

    payload = {
        "summary": summary,
        "waves": waves_stats,
        "teams": teams,
    }

    out_dir = Path(__file__).parent
    js_path = out_dir / "data.js"
    js_content = "// Automaticky generováno skriptem build_data.py z Vysledkova_listina_2026.pdf\n"
    js_content += "window.MCSP_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    js_path.write_text(js_content, encoding="utf-8")

    json_path = out_dir / "vysledky_2026.json"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    csv_path = out_dir / "vysledky_2026.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Č.", "Výsadek", "Plánovaný start", "Na trati", "Název týmu",
            "Stav", "Příchod", "Celkový čas", "Minuty", "Celkové pořadí",
            "Pořadí ve výsadku", "V limitu 18h", "Rychlost (km/h)", "Tempo (min/km)",
            "Mimo vlnu", "Anomálie"
        ])
        for t in teams:
            writer.writerow([
                t["id"], t["wave"], t["wave_scheduled_start"], t["start"], t["name"],
                t["status"], t["arrival"], t["total"], t["total_min"] or "",
                t["rank_overall"] or "", t["rank_in_wave"] or "",
                "Ano" if t["under_18h"] is True else ("Ne" if t["under_18h"] is False else ""),
                t["speed_kmh"] or "", t["pace_min_km"] or "",
                "Ano" if t["wave_jumper"] else "Ne",
                t["anomaly"] or ""
            ])

    print("Summary:", json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Generated {js_path} ({js_path.stat().st_size} bytes), {json_path} and {csv_path}")


if __name__ == "__main__":
    build()
