import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import SpotifyWebApi = require('spotify-web-api-node');
admin.initializeApp();

const APP_NAME = 'PartyDJ';
const ROOM_LENGTH = 6;

/**
 * Generates a spotify playlist for the user and creates a firestore room.
 * @param authToken a spotify authtoken
 * @param username spotify username
 * @returns a generated room code
 */
export const generateRoom = functions.https.onCall(async (data, context) => {

    const roomCode: string = generateCode(ROOM_LENGTH);
    const username: string = data.username;
    const accessToken: string = data.accessToken;
    const spotifyApi: SpotifyWebApi = new SpotifyWebApi({ accessToken: accessToken });
    let playlistId: string;

    // Check the parameters
    if (paramIsEmpty(username)) return paramFail('Username');
    if (paramIsEmpty(accessToken)) return paramFail('Access token');

    // Create Playlist
    try {
        const response = await spotifyApi.createPlaylist(username, APP_NAME + ':' + roomCode, { 'public' : true });
        playlistId = response.body.id;
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Spotify connection failed'
        };
    }
    
    // Create the room
    try {
        await admin.firestore().collection('rooms')
            .doc(roomCode).set({ 'enabled': true, 'owner': username,
             'playlistId':playlistId, songs: [], 'currentSong': {'name': '', 'artist': '', imageUrl: '', uri: ''}});
        return {
            status: 'success',
            roomCode: roomCode,
            playlistId: playlistId
        };
    }
    catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Firestore connection failed'
        };
    }
    
});

/**
 * Deletes/saves the playlist and disables the firestore boolean room
 * @param roomCode the code for the room
 * @param accessToken a spotify access token
 * @param playlistId the id of the playlist
 * @param save a bool if the user wants the room saved
 * @param playlistName (optional) if the user wants the room saved use this name
 * @returns bool if success
 */
export const closeRoom = functions.https.onCall( async (data, context) => {
    const roomCode: string = data.roomCode;
    const accessToken: string = data.accessToken;
    const playlistId: string = data.playlistId;
    const spotifyApi: SpotifyWebApi = new SpotifyWebApi({ accessToken: accessToken });

    // Check the parameters
    if (paramIsEmpty(roomCode)) return paramFail('Room code');
    if (paramIsEmpty(accessToken)) return paramFail('Access token');
    if (paramIsEmpty(playlistId)) return paramFail('Playlist id');

    try {
        await admin.firestore().collection('rooms')
            .doc(roomCode).delete();
    }
    catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Firestore connection failed'
        };
    }

    // Remove the track from the playlist
    try {
        await spotifyApi.unfollowPlaylist(playlistId);
        return {
            status: 'success'
        };
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Spotify connection failed'
        };
    }
    })

/**
 * Adds a song to the spotify playlist
 * @param roomCode the code for the room
 * @param accessToken a spotify access token
 * @param song an object repesenting the song data
 * @returns bool if success
 */
export const addSong = functions.https.onCall( async (data, context) => {
    const roomCode: string = data.roomCode;
    const accessToken: string = data.accessToken;
    const songUri: string = data.songUri;
    const playlistId: string = data.playlistId;
    const spotifyApi: SpotifyWebApi = new SpotifyWebApi({ accessToken: accessToken });

    // Check the parameters
    if (paramIsEmpty(roomCode)) return paramFail('Room code');
    if (paramIsEmpty(accessToken)) return paramFail('Access token');
    if (paramIsEmpty(playlistId)) return paramFail('Playlist id');
    if (paramIsEmpty(songUri)) return paramFail('Song uri');
    
    // Add the track to the playlist
    try {
        await spotifyApi.addTracksToPlaylist(playlistId, [songUri]);
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Spotify connection failed'
        };
    }

    // Get spotify track details
    return updateDatabase(roomCode, playlistId, spotifyApi);
})

/**
 * Removes a song to the spotify playlist
 * @param roomCode the code for the room
 * @param accessToken a spotify access token
 * @param song an object repesenting the song data
 * @returns bool if success
 */
export const removeSong = functions.https.onCall( async (data, context) => {
    const roomCode: string = data.roomCode;
    const accessToken: string = data.accessToken;
    const songUri: string = data.songUri;
    const playlistId: string = data.playlistId;
    const spotifyApi: SpotifyWebApi = new SpotifyWebApi({ accessToken: accessToken });

    // Check the parameters
    if (paramIsEmpty(roomCode)) return paramFail('Room code');
    if (paramIsEmpty(accessToken)) return paramFail('Access token');
    if (paramIsEmpty(playlistId)) return paramFail('Playlist id');
    if (paramIsEmpty(songUri)) return paramFail('Song uri');

    // Remove the track from the playlist
    try {
        await spotifyApi.removeTracksFromPlaylist(playlistId, [{uri: songUri}]);
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Spotify connection failed'
        };
    }

    // Get spotify track details
    return updateDatabase(roomCode, playlistId, spotifyApi);
})

async function updateDatabase(roomCode:string, playlistId: string, spotifyApi : SpotifyWebApi) {

    let spotifyTracks;

    try {
        const response = await spotifyApi.getPlaylistTracks(playlistId);
        spotifyTracks = response.body.items
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Spotify connection failed'
        };
    }

    const tracks = []
    for (const item of spotifyTracks){
        const track = item.track;
        const song = {
            'name': track.name,
            'uri': track.uri,
            'artist': track.artists[0].name,
            'imageUrl': track.album.images[0].url,
            'addedBy': item.added_by.id
        }
        tracks.push(song);
    }
    const tracksObject = { 'songs' : tracks };

    // Push to the firestore
    try {
        await admin.firestore().collection('rooms')
            .doc(roomCode).update(tracksObject);
        return {
            status: 'success'
        }
    }
    catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Firestore connection failed'
        };
    }
}

/**
 * Checks if a room is open
 * @param roomCode a code for the room
 * @returns bool true if enabled, false otherwise
 */
export const joinRoom = functions.https.onCall(async (data, context) => {
    const roomCode = data.roomCode;
    
    // Check the parameter
    if (paramIsEmpty(roomCode)) return paramFail('Room code');

    let playlistId;

    try {
    const docRef = await admin.firestore().collection('rooms').doc(roomCode).get();
        if (docRef.exists) {
            const document = docRef.data();
            if (document === undefined) throw new Error('document is undefined'); 
            playlistId = document.playlistId;
            return {
                status: 'success',
                isRoomOpen: true,
                playlistId: playlistId
            }
        } else {
            return {
                status: 'success',
                isRoomOpen: false
            }
        }
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Firestore connection failed'
        };
    }
})

/**
 * Helper method to generate a room code, excludes similar symbols
 * @param length the length of the room code to generate
 * @returns a randomized string of the spicified length
 */
function generateCode(length: number): string {
    const arr: string = '123456789abcdefghijkmnopqrstuvwxyz';
    let ans: string = ''; 
    for (let i = length; i > 0; i--) { 
        ans +=  arr[Math.floor(Math.random() * arr.length)]; 
    } 
    return ans; 
}

/**
 * Logs and returns a failure
 * @param param parameter to inject in the log
 * @returns the failure code and logs the failure
 */
function paramFail(param: string): object {
    console.error(`${param} is null or ''`)
    return { 
        status: 'error',
        code: 400,
        message: `${param} format incorrect`}
}

/**
 * Checks if a param is null or empty
 * @param param the parameter to test
 * @returns true if null or empty false otherwise
 */
function paramIsEmpty(param: any): boolean {
    return (param == null || param == '');
}