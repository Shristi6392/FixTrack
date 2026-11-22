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
