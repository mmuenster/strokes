import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShotEditForm from './ShotEditForm.jsx';

vi.mock('../api.js', () => ({
  api: { shots: { update: vi.fn() } },
}));

import { api } from '../api.js';

beforeEach(() => {
  api.shots.update.mockReset();
  api.shots.update.mockImplementation(async (id, body) => ({ id, ...body }));
});

const hole = { id: 1, par: 4 };

describe('ShotEditForm — continuation shot (isFirstShot=false)', () => {
  // A putt at 2.4ft (0.8yd) from the hole, currently recorded as holed.
  const shot = {
    id: 2, sequence: 2, category: 'PUTT',
    lie_start: 'GREEN', dist_start: 0.8,
    lie_end: null, dist_end: null, holed: 1,
  };

  it('never includes dist_start or lie_start in the update payload', async () => {
    render(<ShotEditForm shot={shot} hole={hole} isFirstShot={false} onSaved={vi.fn()} onCancel={vi.fn()} />);

    // Mark it as a 2ft miss instead of holed. The distance input has no
    // placeholder/label association in this component, so select it by its
    // implicit "spinbutton" role (type="number").
    fireEvent.click(screen.getByText('Green'));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(api.shots.update).toHaveBeenCalledTimes(1));
    const [id, payload] = api.shots.update.mock.calls[0];
    expect(id).toBe(2);
    expect(payload).not.toHaveProperty('dist_start');
    expect(payload).not.toHaveProperty('lie_start');
    expect(payload.holed).toBe(0);
    expect(payload.lie_end).toBe('GREEN');
    expect(payload.dist_end).toBeCloseTo(2 / 3, 6);
  });

  it('marking it holed again omits dist_start/lie_start too', async () => {
    render(<ShotEditForm shot={shot} hole={hole} isFirstShot={false} onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByText('⛳ Holed'));
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(api.shots.update).toHaveBeenCalledTimes(1));
    const [, payload] = api.shots.update.mock.calls[0];
    expect(payload).not.toHaveProperty('dist_start');
    expect(payload).not.toHaveProperty('lie_start');
    expect(payload.holed).toBe(1);
    expect(payload.dist_end).toBeNull();
    expect(payload.lie_end).toBeNull();
  });
});

describe('ShotEditForm — first shot on the hole (isFirstShot=true)', () => {
  const shot = {
    id: 1, sequence: 1, category: 'OTT',
    lie_start: 'TEE', dist_start: 400,
    lie_end: 'FAIRWAY', dist_end: 150, holed: 0,
  };

  it('includes dist_start/lie_start, reflecting an edited value', async () => {
    render(<ShotEditForm shot={shot} hole={hole} isFirstShot={true} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const distInput = screen.getByDisplayValue('400');
    fireEvent.change(distInput, { target: { value: '410' } });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(api.shots.update).toHaveBeenCalledTimes(1));
    const [, payload] = api.shots.update.mock.calls[0];
    expect(payload.dist_start).toBe(410);
    expect(payload.lie_start).toBe('TEE');
  });
});
