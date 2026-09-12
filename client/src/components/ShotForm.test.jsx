import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShotForm from './ShotForm.jsx';

vi.mock('../api.js', () => ({
  api: { shots: { create: vi.fn() } },
}));

import { api } from '../api.js';

beforeEach(() => {
  api.shots.create.mockReset();
  api.shots.create.mockImplementation(async (holeId, body) => ({
    id: 99, hole_id: holeId, sequence: 1, category: 'APP', sg: 0, ...body,
  }));
});

const hole = { id: 1, par: 4, yardage: 400 };

describe('ShotForm — first shot on a hole', () => {
  it('sends dist_start from the tee, in yards, on save', async () => {
    render(<ShotForm hole={hole} previousShot={null} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. 15'), { target: { value: '150' } });
    fireEvent.click(screen.getByText('Fairway'));
    fireEvent.click(screen.getByText('Save shot'));

    await waitFor(() => expect(api.shots.create).toHaveBeenCalledTimes(1));
    const [holeId, payload] = api.shots.create.mock.calls[0];
    expect(holeId).toBe(1);
    expect(payload).toMatchObject({
      dist_start: 400,
      lie_start: 'TEE',
      dist_end: 150,
      lie_end: 'FAIRWAY',
      holed: 0,
    });
  });
});

describe('ShotForm — continuation shot (a putt)', () => {
  // The previous shot ended on the green, 2.4ft (0.8yd) from the hole.
  const previousShot = { id: 1, sequence: 1, lie_end: 'GREEN', dist_end: 0.8 };

  it('uses the previous shot\'s exact dist_end as dist_start, unrounded', async () => {
    render(<ShotForm hole={hole} previousShot={previousShot} onSaved={vi.fn()} />);

    // Default ending location is GREEN (a putt); enter a 5ft miss.
    fireEvent.change(screen.getByPlaceholderText('e.g. 8'), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Save shot'));

    await waitFor(() => expect(api.shots.create).toHaveBeenCalledTimes(1));
    const [, payload] = api.shots.create.mock.calls[0];
    expect(payload.dist_start).toBe(0.8);
    expect(payload.lie_start).toBe('GREEN');
    expect(payload.dist_end).toBeCloseTo(5 / 3, 6);
  });

  it('records a holed putt with null dist_end/lie_end', async () => {
    render(<ShotForm hole={hole} previousShot={previousShot} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByText('⛳ Holed'));
    fireEvent.click(screen.getByText('Save shot'));

    await waitFor(() => expect(api.shots.create).toHaveBeenCalledTimes(1));
    const [, payload] = api.shots.create.mock.calls[0];
    expect(payload.dist_start).toBe(0.8);
    expect(payload.holed).toBe(1);
    expect(payload.dist_end).toBeNull();
    expect(payload.lie_end).toBeNull();
  });
});

describe('ShotForm — fringe treated like green', () => {
  // The previous shot ended on the fringe, 5ft (1.667yd) from the hole.
  const previousShot = { id: 1, sequence: 1, lie_end: 'FRINGE', dist_end: 5 / 3 };

  it('previews the next shot as Putting, and defaults its own end location to Green', () => {
    render(<ShotForm hole={hole} previousShot={previousShot} onSaved={vi.fn()} />);
    expect(screen.getByText('Putting')).toBeInTheDocument();
    // The "Green" end-location button should already be the active choice.
    expect(screen.getByText('Green')).toHaveClass('bg-gray-700');
  });

  it('enters the ending distance in feet, matching a green-to-green putt', async () => {
    render(<ShotForm hole={hole} previousShot={previousShot} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. 8'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Save shot'));

    await waitFor(() => expect(api.shots.create).toHaveBeenCalledTimes(1));
    const [, payload] = api.shots.create.mock.calls[0];
    expect(payload.dist_start).toBeCloseTo(5 / 3, 6);
    expect(payload.lie_start).toBe('FRINGE');
    expect(payload.dist_end).toBeCloseTo(3 / 3, 6);
  });
});

describe('ShotForm — OB penalty', () => {
  const previousShot = { id: 1, sequence: 1, lie_end: 'FAIRWAY', dist_end: 200 };

  it('creates the shot and a separate stroke-and-distance penalty shot', async () => {
    render(<ShotForm hole={hole} previousShot={previousShot} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByText('OB'));
    fireEvent.click(screen.getByText('Save shot'));

    await waitFor(() => expect(api.shots.create).toHaveBeenCalledTimes(2));
    const [, mainPayload] = api.shots.create.mock.calls[0];
    const [, penaltyPayload] = api.shots.create.mock.calls[1];

    expect(mainPayload).toMatchObject({ dist_start: 200, lie_start: 'FAIRWAY', lie_end: 'OB', dist_end: 200 });
    expect(penaltyPayload).toMatchObject({
      category: 'PENALTY',
      dist_start: 200,
      lie_start: 'FAIRWAY',
      dist_end: 200,
      lie_end: 'FAIRWAY',
      holed: 0,
    });
  });
});
