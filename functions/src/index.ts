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
            .doc(roomCode).set({ 'enabled': true, 'owner': username,
             'playlistId':playlistId, songs: [], 'currentSong': {'name': '', 'artist': '', imageUrl: '', uri: ''}});
        return {
            status: 'success',
            roomCode: roomCode,
            playlistId: playlistId,
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
 * @param roomCode the code for the room
 * @param accessToken a spotify access token
 * @param playlistId the id of the playlist
 * @param save a bool if the user wants the room saved
 * @param playlistName (optional) if the user wants the room saved use this name
 * @returns bool if success
 */
export const closeRoom = functions.https.onCall( async (data, context) => {
    const roomCode = data.roomCode;
    const accessToken = data.accessToken;
    const playlistId = data.playlistId;

    const spotifyApi = new SpotifyWebApi({
        accessToken: accessToken
    });

    try {
        await admin.firestore().collection('rooms')
            .doc(roomCode).delete();
    }
    catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Firestore connection failed',
        };
    }

    
    // remove the track from the playlist
    try {
        await spotifyApi.unfollowPlaylist(playlistId);
        return {
            status: 'success',
        };
    } catch (error) {
        console.error(error);
        return {
            staus: 'error',
            code: 401,
            message: 'Spotify connection failed',
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
    const roomCode = data.roomCode;
    const accessToken = data.accessToken;
    const songUri = data.songUri;
    const playlistId = data.playlistId;

     const spotifyApi = new SpotifyWebApi({
        accessToken: accessToken
    });
    
    // add the track to the playlist
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

/**
 * Removes a song to the spotify playlist
 * @param roomCode the code for the room
 * @param accessToken a spotify access token
 * @param song an object repesenting the song data
 * @returns bool if success
 */
export const removeSong = functions.https.onCall( async (data, context) => {
    const roomCode = data.roomCode;
    const accessToken = data.accessToken;
    const songUri = data.songUri;
    const playlistId = data.playlistId;

    const spotifyApi = new SpotifyWebApi({
        accessToken: accessToken
    });

    
    // remove the track from the playlist
    try {
        await spotifyApi.removeTracksFromPlaylist(playlistId, [songUri]);
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
    console.log('updating the database');
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
        //const addedBy = item.added_by.display_name;
        const track = item.track;
        const name = track.name;
        const uri = track.uri;
        const imageUrl = track.album.images[0].url;
        const artist = track.artists[0].name;
        
        // add the data to a JSON object
        const song = {
            'name': name,
            'uri': uri,
            'artist': artist,
            'imageUrl': imageUrl,
        }
        tracks.push(song);
    }
    const tracksObject = { 'songs' : tracks };

    // push to the firestore
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
            message: 'Firestore connection failed',
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
                playlistId: playlistId,
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
