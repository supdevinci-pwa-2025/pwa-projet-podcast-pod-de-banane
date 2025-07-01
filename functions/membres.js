exports.handler = async (event) => {
  const participant = JSON.parse(event.body);
 
  if (!participant.name || !participant.role) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Il manque le nom ou un rôle !' })
    };
  }
 
  console.log('Participant reçu via Background Sync :', participant);
 
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Participant bien reçu !' })
  };
};