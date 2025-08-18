// js/firebase/firebase-config.js

// TODO: replace with your Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyB00AKhwOaaYuE1cTNjDWKjKqJCA4uQI0I",
    authDomain: "scheduler-prov1.firebaseapp.com",
    projectId: "scheduler-prov1",
    storageBucket: "scheduler-prov1.appspot.com",
    messagingSenderId: "1097157583300",
    appId: "1:1097157583300:web:1db6c6cb5838f75f2dc491"
};

firebase.initializeApp(firebaseConfig);
window.auth = firebase.auth();
window.db = firebase.firestore();