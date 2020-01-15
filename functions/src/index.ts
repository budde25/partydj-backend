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

    let playlistId;

    try {
        const response = await spotifyApi.createPlaylist(username, appName + ':' + roomCode, { 'public' : true });
        playlistId = response.body.id;
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
            .doc(roomCode).set({ 'enabled': true, 'owner': username, 'playlistId':playlistId});
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
export const addSong = functions.https.onCall( async (data, context) => {
    const roomCode = data.roomCode;
    const accessToken = data.accessToken;
    const songUri = data.songUri;

     // create the spotify playlist
     const spotifyApi = new SpotifyWebApi({
        accessToken: accessToken
    });

    // get the playlist uri from firestore
    let playlistId;
    try {
        const docRef = await admin.firestore().collection('rooms')
            .doc(roomCode).get();
        const response = docRef.data();
        
        if (response !== undefined) playlistId = response.playlistId;
        else throw new Error('document refrence is undefined');
    }
    catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Firestore connection failed',
        };
    }

    // add the track to the playlist
    console.log(playlistId);
    try {
        await spotifyApi.addTracksToPlaylist(playlistId, [songUri]);
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Spotify connection failed',
        };
    }

    // ask spotify for the track details
    return updateDatabase(roomCode, playlistId, spotifyApi);

})

async function updateDatabase(roomCode:string, playlistId: string, spotifyApi : SpotifyWebApi) {
    console.log('updateDatabase');
        let spotifyTracks;
    try {
        const response = await spotifyApi.getPlaylistTracks(playlistId);
        spotifyTracks = response.body.items
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Spotify connection failed',
        };
    }

    const tracks = []
    for (const item of spotifyTracks){
        const addedBy = item.added_by;
        const track = item.track;
        const name = track.name;
        const uri = track.uri;;
        const imageUrl = track.album.images[0].url;
        const artist = track.artists[0].name;
        const position = track.track_number;
        
        // add the data to a JSON object
        const song = {
            'name': name,
            'uri': uri,
            'artist': artist,
            'imageUrl': imageUrl,
            'addedBy': addedBy,
            'position': position,
        }
        tracks.push(song);
    }
    const tracksObject = { 'songs' : tracks };

    console.log('push to fire');
    // push to the firestore
    try {
        await admin.firestore().collection('rooms')
            .doc(roomCode).set(tracksObject);
        return {
            status: 'success'
        }
    }
    catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Firestore connection failed',
        };
    }
}

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
