import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();


/**
 * Generates a spotify playlist for the user and creates a firestore room.
 * @param authToken a spotify authtoken
 * @param username spotify username
 * @returns a generated room code
 */
export const generateRoom = functions.https.onRequest((request, response) => {
    const roomCode = generateCode(6);
    admin.firestore().collection('rooms').doc(roomCode)
        .set({'enabled':true,'owner':'budde25'}).then(() => {
        response.send(roomCode);
    }).catch((error) => {
        console.log(error)
        response.status(500).send();
    })
    
});

/**
 * Deletes/saves the playlist and disables the firestore boolean room
 * @param roomCode the code for the room to close
 * @param authToken a spotify authtoken
 * @param save a bool if the user wants the room saved
 * @param playlistName (optional) if the user wants the room saved use this name
 * @returns bool if success
 */
export const closeRoom = functions.https.onRequest((request, response) => {null})

/**
 * Adds a song to the spotify playlist
 * @param roomCode the code for the room to close
 * @param authToken a spotify authtoken
 * @param song an object repesenting the song data
 * @returns bool if success
 */
export const addSong = functions.https.onRequest((request, response) => {null})

/**
 * Checks if a room is open
 * @param roomCode
 * @returns bool true if enabled, false otherwise
 */
export const isRoomOpen = functions.https.onRequest((request, response) => {
    const roomCode = request.query.roomCode;
    response.send(roomCode);
})

/**
 * Helper method to generate a room code, excludes similar symbols
 * @param length the length of the room code to generate
 * @returns a randomized string of the spicified length
 */
function generateCode(length: number): string {
    const arr:string = '123456789abcdefghijkmnopqrstuvwxyz';
    let ans: string = ''; 
    for (let i = length; i > 0; i--) { 
        ans +=  arr[Math.floor(Math.random() * arr.length)]; 
    } 
    return ans; 
}
