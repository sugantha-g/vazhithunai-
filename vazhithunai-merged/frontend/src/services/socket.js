/**
 * socket.js
 * Single socket.io connection shared by the live tracking hooks.
 */

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, { autoConnect: true });

export default socket;
