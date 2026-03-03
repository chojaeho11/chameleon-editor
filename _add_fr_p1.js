const fs = require('fs');
const f = 'long/fr_123.json';
const data = JSON.parse(fs.readFileSync(f, 'utf8'));

const newKeys = {};

const raw = [
  ['ve_clip_required', 'Veuillez d\'abord ajouter un clip'],
  ['ve_audio_none', 'Pas d\'audio'],
  ['ve_audio_no_result', 'Aucun audio trouv\u00e9'],
  ['ve_audio_loading', 'Chargement...'],
  ['ve_audio_fail', '\u00c9chec du chargement'],
  ['ve_audio_label', 'Audio'],
  ['ve_audio_no_conn', 'Pas de connexion \u00e0 la base de donn\u00e9es'],
  ['ve_audio_prev', 'Pr\u00e9c\u00e9dent'],
  ['ve_audio_next', 'Suivant'],
  ['ve_ai_composer', 'Compositeur IA'],
  ['ve_ai_composer_desc', 'G\u00e9n\u00e9rer de la musique avec voix et paroles'],
  ['ve_ai_music_placeholder', 'ex) Musique de caf\u00e9 joyeuse avec piano et guitare'],
  ['ve_ai_music_style', 'Style'],
  ['ve_ai_music_lyrics', 'Paroles'],
  ['ve_ai_music_lyrics_hint', 'max 400 caract\u00e8res, optionnel'],
  ['ve_ai_music_lyrics_placeholder', '[verse]\n\u00c9crivez vos paroles ici...\n\n[chorus]\nParoles du refrain ici...'],
  ['ve_ai_music_generate', 'G\u00e9n\u00e9rer la musique'],
  ['ve_ai_music_my_list', 'Ma musique'],
  ['ve_ai_music_loading', 'Chargement de votre musique...'],
  ['ve_ai_music_no_db', 'Connexion \u00e0 la base de donn\u00e9es requise'],
  ['ve_ai_music_login', 'Veuillez d\'abord vous connecter'],
  ['ve_ai_music_need_input', 'Entrez une description ou s\u00e9lectionnez un style'],
  ['ve_ai_music_starting', 'D\u00e9marrage de la composition IA...'],
  ['ve_ai_music_requesting', 'Envoi de la demande...'],
  ['ve_ai_music_composing', 'Composition en cours...'],
  ['ve_ai_music_queue', 'En file d\'attente...'],
  ['ve_ai_music_saving', 'Sauvegarde...'],
  ['ve_ai_music_done', 'Musique IA g\u00e9n\u00e9r\u00e9e !'],
  ['ve_ai_music_fail', '\u00c9chec de la composition IA'],
  ['ve_ai_music_play_fail', '\u00c9chec de la lecture'],
  ['ve_ai_music_delete_confirm', 'Supprimer cette musique ?']
];

raw.forEach(([k,v]) => newKeys[k] = v);

console.log('Part 1 keys:', Object.keys(newKeys).length);

Object.assign(data, newKeys);
fs.writeFileSync('_tmp_fr_part1.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Part 1 saved. Total keys:', Object.keys(data).length);