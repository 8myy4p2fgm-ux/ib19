// Loopback-only test entry. Production Workers and stores are imported unchanged.
export {ChatRoom} from '../backend/chat/worker.mjs';
import chat from '../backend/chat/worker.mjs';import playlists from '../backend/playlists/worker.mjs';
export default {fetch(request,env){return new URL(request.url).pathname.startsWith('/api/chat/')?chat.fetch(request,env):playlists.fetch(request,env);}};
