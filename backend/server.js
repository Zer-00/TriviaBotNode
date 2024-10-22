// Importación de módulos necesarios
const express = require('express');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const natural = require('natural'); // Importar natural para comparación de texto
const { v4: uuidv4 } = require('uuid'); // Generar identificadores únicos

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
  "Assassin's Creed", "Grand Theft Auto", "Mass Effect", "Portal", "Half-Life", "Skyrim", "Animal Crossing", "Fallout", "Resident Evil"
];

// Mantener un registro de títulos previamente seleccionados para evitar repeticiones
function getRandomGameTitle(previousTitles, maxPrevious = 5) {
  // Filtrar títulos que no se han usado recientemente
  const availableTitles = VIDEO_GAME_TITLES.filter(title => !previousTitles.includes(title));
  if (availableTitles.length === 0) {
    previousTitles.length = 0; // Reiniciar títulos previos si todos fueron utilizados
    availableTitles.push(...VIDEO_GAME_TITLES); // Rellenar con todos los títulos
  }
  // Seleccionar un título al azar
  const selectedTitle = availableTitles[Math.floor(Math.random() * availableTitles.length)];
  previousTitles.push(selectedTitle);
  // Limitar el tamaño de la lista de títulos previos
  if (previousTitles.length > maxPrevious) {
    previousTitles.shift();
  }
  return selectedTitle;
}

// Generar una pregunta fácil sobre videojuegos usando la API de OpenAI
async function generateEasyVideoGameQuestion(existingQuestions, previousTitles) {
  const gameTitle = getRandomGameTitle(previousTitles);
  const prompt = `Genera una pregunta de trivia fácil sobre el videojuego '${gameTitle}'. La pregunta debe ser adecuada para jugadores casuales y centrarse en hechos generales como años de lanzamiento, personajes famosos o directores de juegos conocidos. Evita repetir preguntas o similares a las ya generadas. Incluye tanto la pregunta como la respuesta correcta. Formatea como 'Question: <texto de la pregunta> Answer: <texto de la respuesta>'.`;
  try {
    console.log("Generando pregunta para el videojuego:", gameTitle);
    const response = await openai.chat.completions.create({
     model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un asistente de trivia especializado en videojuegos." },
        { role: "user", content: prompt }
      ]
    });

    // Extraer la pregunta y respuesta del formato esperado
    const match = response.choices[0].message.content.match(/Question:\s*(.*?)\s*Answer:\s*(.*)/s);
    if (match) {
      const question = match[1].trim();
      const answer = match[2].trim();
      console.log("Pregunta generada:", question);
      console.log("Respuesta generada:", answer);
      // Verificar que la pregunta no sea similar a las ya existentes
      const isUnique = existingQuestions.every(existing => natural.JaroWinklerDistance(question, existing.question) < 0.85);
      if (isUnique) {
        return { question, answer, source: "API" };
      } else {
        console.warn("La pregunta generada no es única. Se intentará generar otra.");
      }
    }
  } catch (error) {
    console.error("Error al generar una pregunta con OpenAI: ", error); // Registro detallado del error en la generación de preguntas
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

// Guardar el jugador con la mayor puntuación
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

// Almacenar el nombre del jugador
let playerName = "";
let score = 0;
let questionCount = 0;

// Endpoint para manejar la conversación de trivia
app.post('/api/chat', async (req, res) => {
  const { message, previousTitles } = req.body;

  console.log("Contenido de 'message' recibido:", message);
  console.log("Contenido de 'previousTitles' recibido:", previousTitles);

  try {
    // Preguntar nombre al inicio del juego
    if (!playerName) {
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.json({ type: 'askName', content: 'Por favor, ingresa tu nombre para comenzar.' });
      } else {
        playerName = message.trim();
        console.log(`Nombre del jugador establecido: ${playerName}`);
        // Generar la primera pregunta automáticamente después de saludar
        console.log("Generando primera pregunta...");
        const storedQuestions = loadQuestionsFromFile();
        const generatedQuestions = [];
        const question = await generateEasyVideoGameQuestion(
          storedQuestions.concat(generatedQuestions),
          previousTitles || []
        );
        if (question) {
          questionCount++;
          return res.json({ type: 'greetingAndQuestion', content: `¡Hola, ${playerName}! Comencemos con las preguntas de trivia.`, question: question.question, answer: question.answer });
        } else {
          console.warn("No se pudo generar la primera pregunta.");
          return res.status(404).json({ error: 'No se pudo generar la primera pregunta.' });
        }
      }
    }

    // Generar preguntas automáticamente después de ingresar el nombre
    if (questionCount < 5) {
      console.log("Generando nueva pregunta...");
      // Generar nueva pregunta
      const storedQuestions = loadQuestionsFromFile();
      const generatedQuestions = [];
      const question = await generateEasyVideoGameQuestion(
        storedQuestions.concat(generatedQuestions),
        previousTitles || []
      );
      if (question) {
        console.log("Pregunta generada correctamente:", question);
        questionCount++;
        return res.json({ type: 'question', content: question.question, answer: question.answer });
      } else {
        console.warn("No se pudo generar una nueva pregunta.");
        return res.status(404).json({ error: 'No se pudo generar una nueva pregunta.' });
      }
    } else {
      // Finalizar el juego después de 5 preguntas
      console.log(`Juego terminado. Puntaje final de ${playerName}: ${score}`);
      return res.json({ type: 'endGame', content: `¡Juego terminado, ${playerName}! Tu puntuación final es: ${score} puntos.` });
    }
  } catch (error) {
    console.error("Error interno del servidor: ", error); // Imprimir el error completo para diagnóstico
    return res.status(500).json({
      error: 'Hubo un error procesando la solicitud. Consulte la consola del servidor para más detalles.'
    });
  }
});

// Endpoint para verificar la respuesta del usuario y avanzar a la siguiente pregunta
app.post('/api/answer', (req, res) => {
  const { userInput, correctAnswer } = req.body;

  if (!userInput || userInput.trim().length === 0) {
    console.log("Respuesta vacía no es válida.");
    return res.status(400).json({ error: 'La respuesta no puede estar vacía.' });
  }

  console.log("Verificando respuesta del usuario...");
  const isCorrect = checkAnswer(userInput, correctAnswer);
  if (isCorrect) {
    score += 100;
  }
  console.log("Resultado de la verificación:", isCorrect ? "Correcto" : "Incorrecto");
  return res.json({ type: 'answer', correct: isCorrect, next: questionCount < 5 });
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

// Guardar la puntuación más alta
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

// Servir la aplicación web en la carpeta 'public'
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public', 'index.html')); // Actualización de la ruta de index.html
});

// Inicializar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
