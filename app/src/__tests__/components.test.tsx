import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import {
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Text,
  View,
} from 'react-native';

// ---------------------------------------------------------------------------
// Mock useTheme — returns light palette for all tests
// ---------------------------------------------------------------------------
const mockColors = {
  text: '#0F1419',
  textSecondary: '#536471',
  background: '#FFFFFF',
  surface: '#F7F9F9',
  border: '#EFF3F4',
  primary: '#1D9BF0',
  primaryText: '#FFFFFF',
  danger: '#F4212E',
  dangerText: '#FFFFFF',
  success: '#00BA7C',
};

jest.mock('../hooks/use-theme', () => ({
  useTheme: () => mockColors,
}));

// ---------------------------------------------------------------------------
// Component imports (after mock so useTheme is already replaced)
// ---------------------------------------------------------------------------
import { Button } from '../components/button';
import { Input } from '../components/input';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { TodoCard } from '../components/todo-card';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Flatten a React Native style prop (array, object, or StyleSheet id) to a plain object. */
function flatStyle(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as any) ?? {};
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
describe('Button', () => {
  let onPress: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onPress = jest.fn();
  });

  it('renders title text', () => {
    render(<Button title="Save" onPress={onPress} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('shows ActivityIndicator and hides title while loading', () => {
    const { UNSAFE_getByType, queryByText } = render(
      <Button title="Save" loading onPress={onPress} />,
    );
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(queryByText('Save')).toBeNull();
  });

  it('button is not pressable while loading', () => {
    render(<Button testID="btn" title="Save" loading onPress={onPress} />);
    const pressable = screen.getByTestId('btn');
    expect(pressable.props.accessibilityState?.disabled).toBe(true);
  });

  it('calls onPress when pressed', () => {
    render(<Button title="Go" onPress={onPress} />);
    fireEvent.press(screen.getByText('Go'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("primary variant uses colors.primary as background", () => {
    render(<Button testID="btn" title="Primary" variant="primary" onPress={onPress} />);
    const pressable = screen.getByTestId('btn');
    const flat = flatStyle(pressable.props.style);
    expect(flat.backgroundColor).toBe(mockColors.primary);
  });

  it("danger variant uses colors.danger as background", () => {
    render(<Button testID="btn" title="Delete" variant="danger" onPress={onPress} />);
    const pressable = screen.getByTestId('btn');
    const flat = flatStyle(pressable.props.style);
    expect(flat.backgroundColor).toBe(mockColors.danger);
  });

  it("outline variant has transparent background and a border", () => {
    render(<Button testID="btn" title="Cancel" variant="outline" onPress={onPress} />);
    const pressable = screen.getByTestId('btn');
    const flat = flatStyle(pressable.props.style);
    expect(flat.backgroundColor).toBe('transparent');
    expect(flat.borderWidth).toBe(1);
    expect(flat.borderColor).toBe(mockColors.primary);
  });
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
describe('Input', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders label text when label prop is set', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('does not render label when label prop is omitted', () => {
    render(<Input placeholder="Email" />);
    expect(screen.queryByText('Email')).toBeNull();
  });

  it('renders error text when error prop is set', () => {
    render(<Input error="Required field" />);
    expect(screen.getByText('Required field')).toBeTruthy();
  });

  it('does not render error text when no error', () => {
    render(<Input />);
    expect(screen.queryByText('Required field')).toBeNull();
  });

  it('applies danger border color when error is set', () => {
    const { UNSAFE_getByType } = render(<Input error="Bad input" />);
    const input = UNSAFE_getByType(TextInput);
    const flat = flatStyle(input.props.style);
    expect(flat.borderColor).toBe(mockColors.danger);
  });

  it('applies default border color when no error', () => {
    const { UNSAFE_getByType } = render(<Input />);
    const input = UNSAFE_getByType(TextInput);
    const flat = flatStyle(input.props.style);
    expect(flat.borderColor).toBe(mockColors.border);
  });
});

// ---------------------------------------------------------------------------
// ThemedText
// ---------------------------------------------------------------------------
describe('ThemedText', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders children', () => {
    render(<ThemedText>Hello world</ThemedText>);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it("default variant uses colors.text", () => {
    render(<ThemedText variant="default">Default</ThemedText>);
    const flat = flatStyle(screen.getByText('Default').props.style);
    expect(flat.color).toBe(mockColors.text);
  });

  it("secondary variant uses colors.textSecondary", () => {
    render(<ThemedText variant="secondary">Sub</ThemedText>);
    const flat = flatStyle(screen.getByText('Sub').props.style);
    expect(flat.color).toBe(mockColors.textSecondary);
  });

  it("title variant has large bold text", () => {
    render(<ThemedText variant="title">Big Title</ThemedText>);
    const flat = flatStyle(screen.getByText('Big Title').props.style);
    expect(flat.fontSize).toBe(22);
    expect(flat.fontWeight).toBe('bold');
  });
});

// ---------------------------------------------------------------------------
// ThemedView
// ---------------------------------------------------------------------------
describe('ThemedView', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders children', () => {
    render(
      <ThemedView>
        <ThemedText>Child</ThemedText>
      </ThemedView>,
    );
    expect(screen.getByText('Child')).toBeTruthy();
  });

  it('applies background color from theme', () => {
    render(<ThemedView testID="themed-view" />);
    const view = screen.getByTestId('themed-view');
    const flat = flatStyle(view.props.style);
    expect(flat.backgroundColor).toBe(mockColors.background);
  });
});

// ---------------------------------------------------------------------------
// TodoCard
// ---------------------------------------------------------------------------
describe('TodoCard', () => {
  let onPress: jest.Mock;
  let onToggle: jest.Mock;
  let onLongPress: jest.Mock;
  let baseProps: {
    id: string;
    title: string;
    isCompleted: boolean;
    onPress: jest.Mock;
    onToggle: jest.Mock;
    onLongPress: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    onPress = jest.fn();
    onToggle = jest.fn();
    onLongPress = jest.fn();
    baseProps = {
      id: 'todo-1',
      title: 'Buy groceries',
      isCompleted: false,
      onPress,
      onToggle,
      onLongPress,
    };
  });

  it('renders title', () => {
    render(<TodoCard {...baseProps} />);
    expect(screen.getByText('Buy groceries')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<TodoCard {...baseProps} description="Milk, eggs, bread" />);
    expect(screen.getByText('Milk, eggs, bread')).toBeTruthy();
  });

  it('does not render description when not provided', () => {
    render(<TodoCard {...baseProps} />);
    expect(screen.queryByText('Milk, eggs, bread')).toBeNull();
  });

  it('shows checkmark when completed', () => {
    render(<TodoCard {...baseProps} isCompleted />);
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('title has strikethrough style when completed', () => {
    render(<TodoCard {...baseProps} isCompleted />);
    const flat = flatStyle(screen.getByText('Buy groceries').props.style);
    expect(flat.textDecorationLine).toBe('line-through');
  });

  it('title has no strikethrough when not completed', () => {
    render(<TodoCard {...baseProps} isCompleted={false} />);
    const flat = flatStyle(screen.getByText('Buy groceries').props.style);
    expect(flat.textDecorationLine).toBeUndefined();
  });

  it('calls onPress when card is pressed', () => {
    render(<TodoCard {...baseProps} />);
    fireEvent.press(screen.getByText('Buy groceries'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onToggle when checkbox is pressed', () => {
    render(<TodoCard {...baseProps} />);
    fireEvent.press(screen.getByTestId('checkbox-buy-groceries'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onLongPress on long press', () => {
    render(<TodoCard {...baseProps} />);
    fireEvent(screen.getByText('Buy groceries'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
