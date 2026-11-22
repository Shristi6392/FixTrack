import http from './http';

export const listTickets = (params) => http.get('/tickets', { params }).then((r) => r.data);
export const getTicket = (id) => http.get(`/tickets/${id}`).then((r) => r.data.ticket);
export const createTicket = (body) => http.post('/tickets', body).then((r) => r.data.ticket);
export const uploadPhoto = (id, file) => {
  const fd = new FormData();
  fd.append('photo', file);
  return http.post(`/tickets/${id}/attachments`, fd).then((r) => r.data.attachment);
};
export const setStatus = (id, status) => http.patch(`/tickets/${id}/status`, { status }).then((r) => r.data.ticket);
export const assignTicket = (id, assignee_id) => http.patch(`/tickets/${id}/assign`, { assignee_id }).then((r) => r.data.ticket);
export const getEvents = (id) => http.get(`/tickets/${id}/events`).then((r) => r.data.events);

export const listLocations = () => http.get('/locations').then((r) => r.data.locations);
export const listAssets = (params) => http.get('/assets', { params }).then((r) => r.data.assets);

export const getComments = (id) => http.get(`/tickets/${id}/comments`).then((r) => r.data.comments);
export const addComment = (id, body, is_internal = false) => http.post(`/tickets/${id}/comments`, { body, is_internal }).then((r) => r.data.comment);
export const getAttachments = (id) => http.get(`/tickets/${id}/attachments`).then((r) => r.data.attachments);

export const listUsers = (role) => http.get('/users', { params: { role } }).then((r) => r.data.users);

export const suggestTriage = (title, description) => http.post('/ai/triage', { title, description }).then((r) => r.data);
