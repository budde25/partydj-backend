# Party DJ Backend

![Firebase CD](https://github.com/budde25/partydj-backend/workflows/Firebase%20CI/badge.svg)

The backend for Party DJ mobile application. Serverside function calls that support integration between the app, database,
and spotify api call. Manages the majority of the Web Api calls and updates the database accordingly. This limits the api calls
to Spotify and lets the app stream the database with any changes causing instant updates to the app. In addition to working well with Firestore Cloud Functions allows for seamless serverside code updates without causing disruption to the app.

## Aplication Code

[Party DJ](https://github.com/budde25/PartyDJ)

## Usage
`npm lint` to lint the app and check for warnings.  
`npm serve` to serve the funtions and allow for testing.  
`npm deploy` to deploy the functions to cloud functions.  

## Built With
[Firebase Cloud Functions](https://firebase.google.com/docs/functions/) - Hosts the functions.  
[NodeJS](https://nodejs.org/) - Package manager.  
[Spotify Web Api Node](https://github.com/thelinmichael/spotify-web-api-node) - A Spotify Web API library.  

## Author
Ethan Budd
