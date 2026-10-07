require('dotenv').config({ path: './server/.env', quiet: true });

const request = require('supertest');

describe('Volunteer Availability API Tests', () => {
  const baseURL = 'http://localhost:5000';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYmNjOWIwNzRmZDNkMGEzNGY3MTNlOSIsInJvbGUiOiJ2b2x1bnRlZXIiLCJzdGF0dXMiOiJhcHByb3ZlZCIsImlhdCI6MTc5MTMzMjUwOCwiZXhwIjoxNzkxOTM3MzA4fQ.jBtS0niryxUXU8ZdKnGUjH7ambzLMc_FJOts_ibDysE';

  it('GET /api/volunteer/availability - Should return 200 OK', async () => {
    const res = await request(baseURL)
      .get('/api/volunteer/availability')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('availability');
  });

  it('PATCH /api/volunteer/availability - Should update availability', async () => {
    const res = await request(baseURL)
      .patch('/api/volunteer/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        isAvailable: true,
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '17:00'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});