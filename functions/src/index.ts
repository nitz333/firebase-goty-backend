import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin'; // Es equivalente a: var admin = require("firebase-admin");

import * as express from 'express';
import * as cors from 'cors';

const serviceAccount = require("./serviceAccountKey.json");

// Configuramos la base de datos de firebase para consumirla de manera local:
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://firestore-goty-cc76a.firebaseio.com"
});

// Para trabajar con firestore se necesita una referencia a la base de datos usando las credenciales anteriores:
const db = admin.firestore();

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const helloWorld = functions.https.onRequest((request, response) => {
 response.json({
     mensaje: "Hello World from Firebase Functions!!!"
    });
});

// Esta será la cloud function para obtener nuestros "games of the year"
export const getGOTY = functions.https.onRequest( async(request, response) => {

    // const nombre = request.query.nombre || 'Sin nombre';
    // response.json({
    //     nombre
    // });

    // Necesitamos una referencia a la colección goty que esta en la bd de firestore:
    const gotyRef = db.collection('goty');
    // De momento no me interesa obtener información en tiempo real sino solo obtener la información
    // actual que hat en nuestra base al momento de esta petición, se usará la función get que devuleve ese snapshot.
    // IMPORTANTE: Dado que get() devuelve una promesa, esto implica que la ejecución de este get será asíncrona (inclusive)
    //             si nuestro código estuviese ejecutándose directamente en el servidor de Firebase, pero dado que queremos
    //             un código secuencial, vamos a decir que espere a que la promesa termina de ejecutarse para poder continuar
    //             con lo que siga del código, para eso usamos el await y esto implica tener que hacer que esta función
    //             de flecha sobre la que estamos trabajando devuelva un async.
    const docsSnap = await gotyRef.get(); // Se debe tener cuidado con el contenido de este docsSnap ya que incluso contiene
                                          // información sensible como nuestra clave privada, puede imprimirse con: response.json( docsSnap )
    const juegos = docsSnap.docs.map( docs => docs.data() ); // IMPORTANTE: Estamos en node no en Angular, este map() es de
                                                             //             JavaScript, no se debe confundir con el operador map
                                                             //             de los rxjs de Angular, este map() permite iterar un arreglo.
    
    response.json( juegos );

    // Tip: el estatus de respuesta por defecto en las cloud functions de firebase es 200,
    //      por lo tanto no es necesario establecer explícitamente la función status
    //      a menos que debamos enviar otro código de error, por ejemplo: response.status(400)
});

// Aprovechando que estamos en Node.js vamos a crearnos un servidor para poder realizar peticiones al mismo,
// el servidor de facto para Node.js es Express y es el más utilizado en este lenguaje para atender las peticiones
// REST.

// Express
const app = express();
app.use( cors({ origin: true }) ); // Esto permite aceptar peticiones de cualquier dominio externo (es una configuración muy abierta)

app.get('/goty', async(req, res) => {

    // Es exactamente lo mismo que la function que ya teníamos previamente (getGOTY)
    const gotyRef = db.collection('goty');
    const docsSnap = await gotyRef.get();
    const juegos = docsSnap.docs.map( docs => docs.data() );
    res.json( juegos );

});

app.post('/goty/:id', async(req, res) => {

    // Obtenemos el parámetro enviado por URL
    const id = req.params.id;

    const docRef = db.collection('goty').doc( id );
    const docSnap = await docRef.get();

    // Validamos si existe el ID
    if ( !docSnap.exists )
    {
        res.status(404).json({
            ok: false,
            mensaje: 'No existe el juego con ID ' + id
        });
    }
    else
    {
        // Nota: el "|| { votos: 0 }" en este punto nunca lo va a ejecutar, porque ya sabemos que el juego existe, pero
        //       firebase la pide, si no va a estar señalando un warning, así que para evitar eso la ponemos.
        const current = docSnap.data() || { votos: 0 };

        await docRef.update({
            votos: current.votos + 1
        });

        res.json({
            ok: true,
            mensaje: `Gracias por tu voto al juego '${ current.nombre }'`
        });
    }

});


// Como última línea de código, necesitamos decirle a firebase que tiene a su disposición un servidor express
// que será el encargado de atender a las peticiones, esta configuración sería:
// Nota: api es el nombre que nosotros le queremos dar a nuestro Endpoint base.
// exports.api = functions.https.onRequest( app ); // Esta línea es equivalente a la siguiente:
export const api = functions.https.onRequest( app );
