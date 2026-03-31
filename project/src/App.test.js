import { render, screen } from '@testing-library/react';
import App from './App';

test('renders virtual tee heading', () => {
  render(<App />);
  const heading = screen.getByText(/virtual tee overlay/i);
  expect(heading).toBeInTheDocument();
});
