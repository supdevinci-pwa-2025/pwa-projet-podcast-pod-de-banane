exports.handler = async (event, context) => {
    // Autoriser seulement les requêtes POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Headers:', event.headers);
        console.log('Body:', event.body);

        // Traiter les données du partage
        const contentType = event.headers['content-type'] || '';

        if (contentType.includes('multipart/form-data')) {
            // Pour les fichiers partagés
            console.log('Fichier partagé reçu');

            // Ici tu peux traiter le fichier
            // Par exemple, l'envoyer vers un service de stockage
            // ou extraire les métadonnées

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/html',
                },
                body: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Fichier reçu - Snack'n'Track</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
              .success { color: #4CAF50; }
              .btn { background: #f77f00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; display: inline-block; }
            </style>
          </head>
          <body>
            <h1 class="success">✅ Fichier reçu !</h1>
            <p>Votre fichier a été partagé avec succès vers Snack'n'Track</p>
            <a href="/index.html" class="btn">Retour à l'app</a>
            <script>
              // Optionnel : rediriger automatiquement après 3 secondes
              setTimeout(() => {
                window.location.href = '/index.html';
              }, 3000);
            </script>
          </body>
          </html>
        `
            };
        } else {
            // Pour les données texte/URL
            console.log('Données texte partagées');

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/html',
                },
                body: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Contenu partagé - Snack'n'Track</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
              .success { color: #4CAF50; }
              .btn { background: #f77f00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; display: inline-block; }
            </style>
          </head>
          <body>
            <h1 class="success">✅ Contenu partagé !</h1>
            <p>Le contenu a été partagé avec succès vers Snack'n'Track</p>
            <a href="/index.html" class="btn">Retour à l'app</a>
          </body>
          </html>
        `
            };
        }

    } catch (error) {
        console.error('Erreur:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Erreur lors du traitement du partage'
            })
        };
    }
};