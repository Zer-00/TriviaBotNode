// Importación de módulos necesarios
const express = require('express');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const natural = require('natural'); // Importar natural para comparación de texto
const { v4: uuidv4 } = require('uuid'); // Generar identificadores únicos

// Declarar la variable global para almacenar las sesiones activas
const sessions = {}; // Almacenar las sesiones activas con sessionId como clave

// Configuración del cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Clave de la API desde variables de entorno
});

// Configuración de Express
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); // Middleware para parsear JSON
app.use(express.static(path.join(__dirname, '../frontend'))); // Servir archivos estáticos desde la carpeta 'frontend'

// Lista de títulos de videojuegos para mejorar la variedad de preguntas
const VIDEO_GAME_TITLES = [
  "The Legend of Zelda", "Super Mario Bros", "Sonic the Hedgehog", "Minecraft", "The Witcher 3", "Red Dead Redemption 2",
  "Overwatch", "Fortnite", "Call of Duty", "Halo", "Street Fighter", "Mortal Kombat", "Final Fantasy", "Dark Souls", "Elden Ring",
  "Assassin's Creed", "Grand Theft Auto III", "Grand Theft Auto: Vice City", "Grand Theft Auto: San Andreas", "Grand Theft Auto IV",
  "Grand Theft Auto V", "Mass Effect", "Portal", "Half-Life", "Skyrim", "Animal Crossing", "Fallout", "Resident Evil",
  "God of War", "BioShock", "Destiny", "League of Legends", "The Last of Us", "Horizon Zero Dawn", "Persona 5", "Uncharted",
  "Metal Gear Solid", "Metal Gear Solid 2", "Metal Gear Solid 3", "Metal Gear Solid 4", "Metal Gear Solid V", "Bloodborne",
  "Cyberpunk 2077", "The Sims", "Diablo", "Borderlands", "Doom", "Dragon Age", "Kingdom Hearts", "Tomb Raider",
  "Silent Hill", "Silent Hill 2", "Silent Hill 3", "Silent Hill 4: The Room", "Silent Hill: Origins", "Silent Hill: Homecoming",
  "Silent Hill: Shattered Memories", "Silent Hill: Downpour", "FIFA 17", "FIFA 18", "FIFA 19", "FIFA 20", "FIFA 21", "FIFA 22", "FIFA 23",
  "NBA 2K", "Splatoon", "Pokémon", "Monster Hunter", "Bayonetta", "NieR: Automata", "Xenoblade Chronicles", "Dead Space", "Yakuza",
  "Crash Bandicoot", "Pac-Man", "Tetris", "Castlevania", "Cuphead", "Hades", "Valorant", "Rocket League", "Rainbow Six Siege",
  "Genshin Impact", "Apex Legends", "Dota 2", "Warframe", "Starcraft", "Madden NFL", "For Honor", "Far Cry", "Just Cause",
  "Hitman", "The Elder Scrolls Online", "Sekiro: Shadows Die Twice", "Watch Dogs", "Left 4 Dead", "Team Fortress 2",
  "Shadow of the Colossus", "Darkest Dungeon", "Dark Souls", "Dark Souls II", "Dark Souls III", "Forza Horizon",
  "Forza Horizon 2", "Forza Horizon 3", "Forza Horizon 4", "Forza Horizon 5"
];

const SALVADORAN_CULTURE_TOPICS = [
  "Historia de El Salvador",
  "Platos típicos de El Salvador",
  "Personajes históricos salvadoreños",
  "Festividades y costumbres de El Salvador",
  "Sitios turísticos en El Salvador",
  "Música y danzas tradicionales de El Salvador",
  "Artistas y literatura salvadoreña"
];

// Función para obtener un título aleatorio basado en la categoría
function getRandomTitle(category, previousTitles = []) {
  let availableTitles;
  if (category === 'video_games') {
    availableTitles = VIDEO_GAME_TITLES.filter(title => !previousTitles.includes(title));
  } else if (category === 'salvadoran_culture') {
    availableTitles = SALVADORAN_CULTURE_TOPICS.filter(title => !previousTitles.includes(title));
  }

  if (!availableTitles || availableTitles.length === 0) {
    previousTitles.length = 0;
    availableTitles = category === 'video_games' ? VIDEO_GAME_TITLES : SALVADORAN_CULTURE_TOPICS;
  }

  const selectedTitle = availableTitles[Math.floor(Math.random() * availableTitles.length)];
  previousTitles.push(selectedTitle);
  return selectedTitle;
}

// Generar una pregunta basada en la categoría
async function generateQuestion(category, existingQuestions, previousTitles) {
  const topic = getRandomTitle(category, previousTitles);
  const prompt = category === 'video_games'
    ? `Genera una pregunta de trivia fácil sobre el videojuego '${topic}'. La pregunta debe centrarse en hechos generales como años de lanzamiento, personajes famosos o directores de juegos conocidos. Incluye tanto la pregunta como la respuesta correcta. Formatea como 'Question: <texto de la pregunta> Answer: <texto de la respuesta>'.`
    : `Genera una pregunta de trivia fácil sobre el tema '${topic}' de la cultura salvadoreña. La pregunta debe ser adecuada para un público general y centrarse en datos históricos, personajes importantes o aspectos culturales clave. Incluye tanto la pregunta como la respuesta correcta. Formatea como 'Question: <texto de la pregunta> Answer: <texto de la respuesta>'.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Eres un asistente de trivia que genera preguntas sobre videojuegos y cultura salvadoreña, recuerda que: debes verificar bien la informacion que uses" },
        { role: "user", content: prompt }
      ]
    });

    const match = response.choices[0].message.content.match(/Question:\s*(.*?)\s*Answer:\s*(.*)/s);
    if (match) {
      const question = match[1].trim();
      const answer = match[2].trim();
      const isUnique = existingQuestions.every(existing => natural.JaroWinklerDistance(question, existing.question) < 0.85);
      if (isUnique) {
        console.log("Pregunta generada:", question);
        console.log("Respuesta generada:", answer);
        return { question, answer, source: "API" };
      } else {
        console.warn("La pregunta generada no es única. Se intentará generar otra.");
      }
    }
  } catch (error) {
    console.error("Error al generar una pregunta con OpenAI: ", error);
  }
  return null;
}

// Guardar una nueva pregunta en el archivo
function saveQuestionToFile(questionData, filePath = "trivia_questions.json") {
  try {
    let data = [];
    // Verificar si el archivo existe y leer su contenido
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      if (fileContent) {
        data = JSON.parse(fileContent);
      }
    }

    // Verificar si la nueva pregunta es suficientemente distinta
    const isSimilar = data.some(existing => natural.JaroWinklerDistance(questionData.question, existing.question) >= 0.85);
    if (!isSimilar) {
      data.push(questionData);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf-8");
      console.log("Pregunta guardada en el archivo.");
    } else {
      console.log("La pregunta ya existe o es muy similar a una existente. No se guardará.");
    }
  } catch (e) {
    console.error("Error al guardar la pregunta en el archivo: ", e);
  }
}

// Cargar preguntas desde un archivo
function loadQuestionsFromFile(filePath = "trivia_questions.json") {
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      if (fileContent) {
        const data = JSON.parse(fileContent);
        // Añadir un campo de fuente si no está presente
        data.forEach(question => {
          if (!question.source) {
            question.source = "Stored";
          }
        });
        console.log("Preguntas cargadas desde el archivo:", data.length);
        return data;
      }
    } catch (error) {
      console.error("Error al cargar las preguntas desde el archivo: ", error); // Registro detallado del error al cargar preguntas
    }
  }
  return [];
}

// Guardar la puntuación más alta
function saveHighScore(playerName, score, filePath = "high_score.json") {
  try {
    let highScoreData = { name: "", score: 0 };
    // Verificar si el archivo de puntuaciones existe y leer su contenido
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      if (fileContent) {
        highScoreData = JSON.parse(fileContent);
      }
    }

    // Actualizar la puntuación si es un nuevo récord
    if (score > highScoreData.score) {
      highScoreData = { name: playerName, score };
      fs.writeFileSync(filePath, JSON.stringify(highScoreData, null, 4), "utf-8");
      console.log(`¡Nuevo récord! ${playerName} tiene la puntuación más alta con ${score} puntos.`);
    } else {
      console.log(`La puntuación más alta sigue siendo de ${highScoreData.name} con ${highScoreData.score} puntos.`);
    }
  } catch (e) {
    console.error("Error al guardar la puntuación más alta: ", e);
  }
}

// Cargar la puntuación más alta
function loadHighScore(filePath = "high_score.json") {
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      if (fileContent) {
        console.log("Cargando la puntuación más alta desde el archivo...");
        return JSON.parse(fileContent);
      }
    } catch (error) {
      console.error("Error al cargar la puntuación más alta: ", error); // Registro detallado del error al cargar la puntuación
    }
  }
  return { name: "", score: 0 };
}

// Función para normalizar texto y eliminar acentos y caracteres especiales
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD") // Normalizar para separar caracteres con diacríticos
    .replace(/[\u0300-\u036f]/g, "") // Eliminar diacríticos
    .replace(/[^a-z0-9 ]/g, ""); // Eliminar caracteres especiales
}

// Comprobar si la respuesta del usuario es correcta
function checkAnswer(userInput, correctAnswer) {
  let userInputCleaned = normalizeText(userInput);
  let answerCleaned = normalizeText(correctAnswer);
  const possibleAnswers = answerCleaned.split('/').map(ans => ans.trim());

  const synonyms = {
    "rdr2": "red dead redemption 2",
    "cod": "call of duty",
    "zelda": "the legend of zelda",
    "gta": "grand theft auto",
    "ff": "final fantasy",
    "re": "resident evil",
    "mk": "mortal kombat",
  };

  // Reemplazar sinónimos en la entrada del usuario
  for (const key in synonyms) {
    if (userInputCleaned.includes(key)) {
      userInputCleaned = userInputCleaned.replace(key, synonyms[key]);
    }
  }

  // Reemplazar sinónimos en la respuesta correcta
  for (const possibleAnswer of possibleAnswers) {
    let possibleAnswerCleaned = normalizeText(possibleAnswer);
    for (const key in synonyms) {
      if (possibleAnswerCleaned.includes(key)) {
        possibleAnswerCleaned = possibleAnswerCleaned.replace(key, synonyms[key]);
      }
    }

    // Comparaciones múltiples para verificar la igualdad
    if (userInputCleaned === possibleAnswerCleaned) return true;
    if (userInputCleaned.length > 2 && possibleAnswerCleaned.includes(userInputCleaned)) return true;
    if (possibleAnswerCleaned.length > 2 && userInputCleaned.includes(possibleAnswerCleaned)) return true;
    const similarityRatio = natural.JaroWinklerDistance(userInputCleaned, possibleAnswerCleaned);
    if (similarityRatio > 0.9) return true;

    const userTokens = new Set(userInputCleaned.split(" "));
    const answerTokens = new Set(possibleAnswerCleaned.split(" "));
    if ([...userTokens].every(token => answerTokens.has(token)) || [...answerTokens].every(token => userTokens.has(token))) {
      return true;
    }
  }

  return false;
}

// Almacenar el nombre del jugador y otras variables de estado
let playerName = "";
let score = 0;
let questionCount = 0;
let selectedCategory = "";
let previousTitles = [];

// Endpoint para manejar la conversación de trivia
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  // Si no hay sessionId o la sesión no existe, crea una nueva
  if (!sessionId || !sessions[sessionId]) {
    console.log("Sessions object: ", sessions);
      const newSessionId = uuidv4();
      sessions[newSessionId] = { playerName: "", score: 0, questionCount: 0, selectedCategory: "", previousTitles: [] };
      return res.json({ type: 'askName', content: 'Por favor, ingresa tu nombre para comenzar.', sessionId: newSessionId });
  }

  // Al inicio de cada endpoint
  sessions[sessionId].lastActive = Date.now();

  const session = sessions[sessionId]; // Acceder a la sesión específica del usuario

  try {
      // Preguntar nombre al inicio del juego si no está establecido
      if (!session.playerName) {
          if (!message || typeof message !== 'string' || message.trim().length === 0) {
              return res.json({ type: 'askName', content: 'Por favor, ingresa tu nombre para comenzar.', sessionId });
          } else {
              session.playerName = message.trim();
              console.log(`Nombre del jugador establecido: ${session.playerName}`);
              // Pedir categoría después de recibir el nombre
              return res.json({ type: 'askCategory', content: `Hola ${session.playerName}! Por favor elige una categoría: 'videojuegos' o 'cultura salvadoreña'`, sessionId });
          }
      }

      // Si la categoría no está seleccionada, pedirla
      if (!session.selectedCategory) {
          const lowerMessage = message.trim().toLowerCase();
          console.log("Categoría ingresada:", lowerMessage); // Log para verificar la categoría ingresada
          if (lowerMessage === 'videojuegos' || lowerMessage === 'cultura salvadoreña') {
              session.selectedCategory = lowerMessage === 'videojuegos' ? 'video_games' : 'salvadoran_culture';
              console.log(`Categoría seleccionada: ${session.selectedCategory}`);
          } else {
              console.log("Categoría no válida ingresada.");
              return res.json({ type: 'askCategory', content: 'Categoría no válida. Por favor elige "videojuegos" o "cultura salvadoreña".', sessionId });
          }
      }

      // Ahora, generar preguntas
      if (session.questionCount < 5) {
          console.log("Generando nueva pregunta en la categoría:", session.selectedCategory);
          const storedQuestions = loadQuestionsFromFile();
          const question = await generateQuestion(session.selectedCategory, storedQuestions, session.previousTitles);
          if (question) {
              session.questionCount++;
              return res.json({ type: 'question', content: question.question, answer: question.answer, sessionId });
          } else {
              console.warn("No se pudo generar una pregunta.");
              return res.status(404).json({ error: 'No se pudo generar una pregunta.', sessionId });
          }
      } else {
          // Finalizar el juego después de 5 preguntas y preguntar si quiere jugar de nuevo
          console.log(`Juego terminado. Puntaje final de ${session.playerName}: ${session.score}`);
          // Guardar la puntuación más alta
          saveHighScore(session.playerName, session.score);
          return res.json({ type: 'endGame', content: `¡Juego terminado, ${session.playerName}! Tu puntuación final es: ${session.score} puntos. ¿Quieres jugar de nuevo? (mismo/nuevo/no)`, sessionId });
      }
  } catch (error) {
      console.error("Error interno del servidor: ", error); // Imprimir el error completo para diagnóstico
      return res.status(500).json({
          error: 'Hubo un error procesando la solicitud. Consulte la consola del servidor para más detalles.'
      });
  }
});

// Endpoint para manejar la decisión del usuario de jugar de nuevo
app.post('/api/restart', (req, res) => {
  const { sessionId, message } = req.body;

  console.log("Received /api/restart request with body:", req.body);

  // Verificar si sessionId está presente y existe en las sesiones activas
  if (!sessionId || !sessions[sessionId]) {
      return res.status(400).json({ error: 'Sesión no válida o no encontrada.' });
  }

  // Al inicio de cada endpoint
  sessions[sessionId].lastActive = Date.now();

  const session = sessions[sessionId]; // Acceder a la sesión específica del usuario

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Respuesta no válida.', sessionId });
  }

  const lowerMessage = message.trim().toLowerCase();

  if (lowerMessage === 'no') {
      // El usuario no quiere seguir jugando, se elimina la sesión y se termina el juego
      console.log("El usuario ha decidido no continuar jugando.");
      delete sessions[sessionId];
      return res.json({ type: 'endGame', content: 'Está bien, gracias por jugar. Si deseas jugar nuevamente, solo ingresa tu nombre.' });
  } else if (lowerMessage === 'mismo') {
      // El usuario quiere continuar con el mismo nombre, se reinicia la sesión
      console.log("El usuario ha decidido continuar con el mismo nombre.");
      session.score = 0;
      session.questionCount = 0;
      session.selectedCategory = "";
      session.previousTitles = [];
      return res.json({ type: 'greeting', content: `¡Bienvenido de nuevo, ${session.playerName}! Por favor elige una categoría: 'videojuegos' o 'cultura salvadoreña'`, sessionId });
  } else if (lowerMessage === 'nuevo') {
      // El usuario quiere cambiar de nombre, se reinicia la sesión y se solicita un nuevo nombre
      console.log("El usuario ha decidido jugar con un nuevo nombre.");
      session.playerName = "";
      session.score = 0;
      session.questionCount = 0;
      session.selectedCategory = "";
      session.previousTitles = [];
      return res.json({ type: 'askName', content: 'Por favor, ingresa tu nuevo nombre para comenzar.', sessionId });
  } else {
      // Respuesta no reconocida
      console.log("Respuesta no reconocida en /api/restart:", lowerMessage);
      return res.status(400).json({ error: 'Respuesta no reconocida. Por favor responde "mismo", "nuevo", o "no".', sessionId });
  }
});


// Endpoint para verificar la respuesta del usuario y avanzar a la siguiente pregunta
app.post('/api/answer', (req, res) => {
  const { sessionId, userInput, correctAnswer } = req.body;

  console.log("Received /api/answer request with body:", req.body);

  // Verificar si sessionId está presente y existe en las sesiones activas
  if (!sessionId || !sessions[sessionId]) {
      return res.status(400).json({ error: 'Sesión no válida o no encontrada.' });
  }

  // Al inicio de cada endpoint
  sessions[sessionId].lastActive = Date.now();

  const session = sessions[sessionId]; // Acceder a la sesión específica del usuario

  if (!userInput || userInput.trim().length === 0) {
      console.log("Respuesta vacía no es válida.");
      return res.status(400).json({ error: 'La respuesta no puede estar vacía.', sessionId });
  }

  console.log("Verificando respuesta del usuario...");
  const isCorrect = checkAnswer(userInput, correctAnswer);
  if (isCorrect) {
      session.score += 100; // Incrementa el puntaje de la sesión actual
  }
  console.log("Resultado de la verificación:", isCorrect ? "Correcto" : "Incorrecto");

  // Incluir la respuesta correcta en la respuesta al cliente
  return res.json({
      type: 'answer',
      correct: isCorrect,
      next: session.questionCount < 5,
      correctAnswer: correctAnswer,
      sessionId
  });
});


// Endpoint para obtener la puntuación más alta
app.get('/api/highscore', (req, res) => {
  try {
    const highScore = loadHighScore();
    console.log("Puntuación más alta cargada:", highScore);
    res.json(highScore);
  } catch (error) {
    console.error("Error al obtener la puntuación más alta: ", error); // Registro detallado del error al obtener la puntuación más alta
    res.status(500).json({ error: 'Hubo un error al obtener la puntuación más alta.' });
  }
});

// Proceso de limpieza automática de sesiones inactivas
setInterval(() => {
  console.log(`Sesión ${sessionId} eliminada por inactividad.`);
  const now = Date.now();
  for (const sessionId in sessions) {
      if (now - sessions[sessionId].lastActive > 3600000) { // 1 hora de inactividad
          delete sessions[sessionId];
      }
  }
}, 3600000); // Ejecuta cada hora

// Servir la aplicación web en la carpeta 'public'
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public', 'index.html')); // Actualización de la ruta de index.html
});

// Inicializar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
