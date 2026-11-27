// Versículos para el "versículo del día": referencias conocidas de ánimo, fe y adoración.
// El texto se toma de la Biblia del sistema (Reina-Valera 1960) y queda guardado en la caché.
export const DAILY_VERSES = [
  'Juan 3:16', 'Salmos 23:1', 'Filipenses 4:13', 'Jeremías 29:11', 'Proverbios 3:5-6', 'Isaías 41:10', 'Romanos 8:28', 'Josué 1:9',
  'Mateo 11:28', 'Salmos 46:1', 'Isaías 40:31', 'Salmos 37:5', 'Romanos 12:2', 'Filipenses 4:6-7', '2 Timoteo 1:7', 'Salmos 121:1-2',
  'Lamentaciones 3:22-23', 'Mateo 6:33', 'Hebreos 11:1', 'Salmos 27:1', 'Romanos 15:13', 'Juan 14:6', 'Juan 14:27', 'Salmos 91:1-2',
  'Isaías 26:3', 'Salmos 34:8', 'Efesios 2:8-9', 'Gálatas 2:20', '1 Corintios 13:4-5', '1 Juan 4:19', 'Juan 15:5', 'Salmos 118:24',
  'Deuteronomio 31:6', 'Salmos 55:22', '1 Pedro 5:7', 'Mateo 28:20', 'Salmos 16:11', 'Romanos 5:8', 'Isaías 43:2', 'Salmos 139:14',
  'Proverbios 16:3', 'Salmos 19:14', 'Colosenses 3:23', 'Salmos 100:4', 'Salmos 150:6', 'Salmos 95:1-2', 'Salmos 96:1-2', 'Salmos 103:1-2',
  'Salmos 145:18', 'Sofonías 3:17', 'Nahúm 1:7', 'Habacuc 3:19', 'Miqueas 6:8', 'Isaías 9:6', 'Isaías 53:5', 'Isaías 55:8-9',
  'Isaías 12:2', 'Isaías 30:15', 'Jeremías 33:3', 'Jeremías 17:7', 'Ezequiel 36:26', 'Joel 2:28', 'Salmos 4:8', 'Salmos 5:3',
  'Salmos 9:1', 'Salmos 18:2', 'Salmos 28:7', 'Salmos 30:5', 'Salmos 31:24', 'Salmos 32:8', 'Salmos 33:20-21', 'Salmos 40:1-2',
  'Salmos 42:11', 'Salmos 51:10', 'Salmos 56:3', 'Salmos 59:16', 'Salmos 62:1-2', 'Salmos 63:1', 'Salmos 73:26', 'Salmos 84:11',
  'Salmos 86:5', 'Salmos 90:12', 'Salmos 92:1-2', 'Salmos 107:1', 'Salmos 112:7', 'Salmos 119:105', 'Salmos 119:114', 'Salmos 126:3',
  'Salmos 136:1', 'Salmos 138:8', 'Salmos 143:8', 'Salmos 147:3', 'Proverbios 4:23', 'Proverbios 18:10', 'Proverbios 19:21', 'Proverbios 22:6',
  'Proverbios 3:9', 'Proverbios 15:1', 'Eclesiastés 3:1', 'Eclesiastés 4:9-10', 'Mateo 5:14', 'Mateo 5:16', 'Mateo 6:34', 'Mateo 7:7',
  'Mateo 18:20', 'Mateo 22:37', 'Marcos 9:23', 'Marcos 10:27', 'Marcos 11:24', 'Lucas 1:37', 'Lucas 6:31', 'Lucas 12:32',
  'Juan 1:12', 'Juan 8:12', 'Juan 8:32', 'Juan 10:10', 'Juan 10:11', 'Juan 11:25', 'Juan 13:34', 'Juan 16:33',
  'Hechos 1:8', 'Hechos 16:31', 'Romanos 1:16', 'Romanos 6:23', 'Romanos 8:1', 'Romanos 8:31', 'Romanos 8:37', 'Romanos 8:38-39',
  'Romanos 10:9', 'Romanos 12:12', 'Romanos 12:21', '1 Corintios 10:13', '1 Corintios 15:57', '1 Corintios 16:14', '2 Corintios 4:16', '2 Corintios 5:7',
  '2 Corintios 5:17', '2 Corintios 9:7', '2 Corintios 12:9', 'Gálatas 5:22-23', 'Gálatas 6:9', 'Efesios 3:20', 'Efesios 4:32', 'Efesios 6:10',
  'Filipenses 1:6', 'Filipenses 2:3', 'Filipenses 4:4', 'Filipenses 4:8', 'Filipenses 4:19', 'Colosenses 3:2', 'Colosenses 3:15', 'Colosenses 3:16',
  '1 Tesalonicenses 5:16-18', '2 Tesalonicenses 3:3', '1 Timoteo 4:12', '2 Timoteo 3:16', 'Hebreos 4:16', 'Hebreos 10:23', 'Hebreos 12:1-2', 'Hebreos 13:5',
  'Hebreos 13:8', 'Santiago 1:5', 'Santiago 1:12', 'Santiago 4:8', 'Santiago 5:16', '1 Pedro 2:9', '1 Pedro 3:15', '1 Pedro 4:8',
  '1 Juan 1:9', '1 Juan 3:1', '1 Juan 4:4', '1 Juan 4:18', '1 Juan 5:14', 'Apocalipsis 3:20', 'Apocalipsis 21:4', 'Génesis 1:1',
  'Génesis 28:15', 'Éxodo 14:14', 'Éxodo 15:2', 'Números 6:24-26', 'Deuteronomio 7:9', 'Josué 24:15', '1 Samuel 16:7', '2 Samuel 22:31',
  '1 Crónicas 16:11', '1 Crónicas 16:34', '2 Crónicas 7:14', 'Nehemías 8:10', 'Job 19:25', 'Isaías 40:8', 'Isaías 54:10', 'Isaías 58:11',
  'Isaías 60:1', 'Isaías 61:1', 'Jeremías 31:3', 'Daniel 2:20', 'Zacarías 4:6', 'Malaquías 3:10', 'Mateo 4:4', 'Mateo 5:8'
];
