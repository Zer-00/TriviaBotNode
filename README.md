# TriviaBotNode
PRIMERO DE TODO IMPORTANTE AL MOMENTO DE HACER PULL DE EL PROYECTO VERIFICAR QUE ESTE EL ARCHIVO .gitignore
DENTRO DE EL DEBE ESTAR LO SIGUIENTE:
(en el .env para añadir comentarios se usa el #)

//Ignorar archivos de entorno
.env

// Ignorar node_modules
node_modules/

// Ignorar archivos de lock de dependencias si no los necesitas
package-lock.json

ESTO CON EL FIN DE EVITAR PROBLEMAS DE CODIGO Y CON OPENAI AL REVELAR LA APIKEY

------------------------------------------------------------------------------------------------------------------------------------------------------------------

Hay que crear un archivo llamado .env en la carpeta backend en la cual debe especificarse:
    1. La api key de chat gpt
    2. el puerto en el que va a operar Node (normalmente el 3000)

El archivo .env se veria algo asi: 
//Clave de la API de OpenAI (reemplázala con tu clave real)
OPENAI_API_KEY= AQUI IRIA LA API KEY QUE POR NADA DE EL MUNDO SE DEBE HACER PUBLICA NI SUBIRSE A NINGUN REPOSITORIO PORQUE SI NO LA BLOQUEAN

//Configuración del puerto (puedes cambiarlo si lo deseas)
PORT=3000
