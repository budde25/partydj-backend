import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import SpotifyWebApi = require('spotify-web-api-node');
admin.initializeApp();

const appName = 'spotifyQueue';

/**
 * Generates a spotify playlist for the user and creates a firestore room.
 * @param authToken a spotify authtoken
 * @param username spotify username
 * @returns a generated room code
 */
export const generateRoom = functions.https.onCall(async (data, context) => {

    const roomCode = generateCode(6);
    const username = data.username;
    const accessToken = data.accessToken;

    // create the spotify playlist
    const spotifyApi = new SpotifyWebApi({
        accessToken: accessToken
    });

    let playlistUri;

    try {
        const response = await spotifyApi.createPlaylist(username, appName + ':' + roomCode, { 'public' : true });
        playlistUri = response.body.uri;
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Spotify connection failed',
        };
    }
    

    // create the room
    try {
        await admin.firestore().collection('rooms')
            .doc(roomCode).set({ 'enabled': true, 'owner': username, 'playlistUri':playlistUri});
        return {
            status: 'success',
            roomCode: roomCode,
        };
    }
    catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Firestore connection failed',
        };
    }
    
});

/**
 * Deletes/saves the playlist and disables the firestore boolean room
 * @param roomCode the code for the room to close
 * @param accessToken a spotify access token
 * @param save a bool if the user wants the room saved
 * @param playlistName (optional) if the user wants the room saved use this name
 * @returns bool if success
 */
export const closeRoom = functions.https.onCall( async (data, context) => {
    const roomCode = data.roomCode;
    try {
        await admin.firestore().collection('rooms')
            .doc(roomCode).delete();
        return {
            status: 'success',
        };
    }
    catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Firestore connection failed',
        };
    }
    })

/**
 * Adds a song to the spotify playlist
 * @param roomCode the code for the room to close
 * @param accessToken a spotify access token
 * @param song an object repesenting the song data
 * @returns bool if success
 */
export const addSong = functions.https.onCall((data, context) => {null})

/**
 * Checks if a room is open
 * @param roomCode
 * @returns bool true if enabled, false otherwise
 */
export const isRoomOpen = functions.https.onCall(async (data, context) => {
    const roomCode = data.roomCode;
    
    try {
    const docRef = await admin.firestore().collection('rooms').doc(roomCode).get();
        if (docRef.exists) {
            return {
                status: 'success',
                isRoomOpen: true,
            }
        } else {
            return {
                status: 'success',
                isRoomOpen: false,
            }
        }
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Firestore connection failed',
        };
    }
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
