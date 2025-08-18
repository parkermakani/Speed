import { useState } from 'react'
import { Stack, Text, Button, Input, Card, FormField } from '../components/primitives'

export function Demo() {
  const [inputValue, setInputValue] = useState('')
  const [showError, setShowError] = useState(false)

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--color-bg)',
      padding: 'var(--space-container)' 
    }}>
      <Stack spacing="xl">
        <Text as="h1" size="4xl" weight="bold" align="center">
          Design System Demo
        </Text>
        
        <Text size="lg" color="secondary" align="center">
          A showcase of our primitive components using design tokens
        </Text>

        {/* Typography */}
        <Card>
          <Stack spacing="md">
            <Text as="h2" size="2xl" weight="semibold">Typography</Text>
            <Stack spacing="sm">
              <Text size="4xl" weight="bold">Heading 4XL Bold</Text>
              <Text size="3xl" weight="semibold">Heading 3XL Semibold</Text>
              <Text size="2xl" weight="medium">Heading 2XL Medium</Text>
              <Text size="xl">Body XL Normal</Text>
              <Text size="lg" color="secondary">Body Large Secondary</Text>
              <Text size="base">Body Base Text</Text>
              <Text size="sm" color="muted">Small Muted Text</Text>
              <Text size="xs" font="mono" color="accent">Extra Small Monospace</Text>
            </Stack>
          </Stack>
        </Card>

        {/* Colors */}
        <Card>
          <Stack spacing="md">
            <Text as="h2" size="2xl" weight="semibold">Colors</Text>
            <Stack direction="row" spacing="md" wrap>
              <Text color="primary">Primary Text</Text>
              <Text color="secondary">Secondary Text</Text>
              <Text color="muted">Muted Text</Text>
              <Text color="accent">Accent Text</Text>
              <Text color="success">Success Text</Text>
              <Text color="warning">Warning Text</Text>
              <Text color="error">Error Text</Text>
            </Stack>
          </Stack>
        </Card>

        {/* Buttons */}
        <Card>
          <Stack spacing="md">
            <Text as="h2" size="2xl" weight="semibold">Buttons</Text>
            
            <Stack spacing="sm">
              <Text size="lg" weight="medium">Variants</Text>
              <Stack direction="row" spacing="md" wrap>
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
              </Stack>
            </Stack>

            <Stack spacing="sm">
              <Text size="lg" weight="medium">Sizes</Text>
              <Stack direction="row" spacing="md" wrap align="center">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </Stack>
            </Stack>

            <Stack spacing="sm">
              <Text size="lg" weight="medium">States</Text>
              <Stack direction="row" spacing="md" wrap>
                <Button disabled>Disabled</Button>
                <Button loading>Loading</Button>
                <Button fullWidth>Full Width</Button>
              </Stack>
            </Stack>
          </Stack>
        </Card>

        {/* Form Components */}
        <Card>
          <Stack spacing="md">
            <Text as="h2" size="2xl" weight="semibold">Form Components</Text>
            
            <Stack spacing="lg">
              <FormField label="Basic Input" description="Enter some text">
                <Input 
                  placeholder="Type something..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              </FormField>

              <FormField 
                label="Required Field" 
                required
                error={showError ? "This field is required" : undefined}
              >
                <Input 
                  placeholder="Required input"
                  error={showError}
                />
              </FormField>

              <Stack direction="row" spacing="md">
                <Button 
                  variant="secondary" 
                  onClick={() => setShowError(!showError)}
                >
                  Toggle Error
                </Button>
                <Button variant="primary">Submit Form</Button>
              </Stack>

              <Stack spacing="sm">
                <Text size="lg" weight="medium">Input Sizes</Text>
                <FormField label="Small Input">
                  <Input size="sm" placeholder="Small input" />
                </FormField>
                <FormField label="Medium Input">
                  <Input size="md" placeholder="Medium input" />
                </FormField>
                <FormField label="Large Input">
                  <Input size="lg" placeholder="Large input" />
                </FormField>
              </Stack>
            </Stack>
          </Stack>
        </Card>

        {/* Cards */}
        <Card>
          <Stack spacing="md">
            <Text as="h2" size="2xl" weight="semibold">Card Variants</Text>
            
            <Stack spacing="md">
              <Card variant="default" padding="md">
                <Text weight="medium">Default Card</Text>
                <Text size="sm" color="secondary">With medium padding and default styling</Text>
              </Card>

              <Card variant="elevated" padding="lg">
                <Text weight="medium">Elevated Card</Text>
                <Text size="sm" color="secondary">With large padding and elevated shadow</Text>
              </Card>

              <Card variant="outlined" padding="sm" clickable onClick={() => alert('Card clicked!')}>
                <Text weight="medium">Clickable Outlined Card</Text>
                <Text size="sm" color="secondary">Click me! Small padding with border</Text>
              </Card>
            </Stack>
          </Stack>
        </Card>

        {/* Layout */}
        <Card>
          <Stack spacing="md">
            <Text as="h2" size="2xl" weight="semibold">Layout (Stack)</Text>
            
            <Stack spacing="sm">
              <Text weight="medium">Row Direction</Text>
              <Stack direction="row" spacing="md" align="center">
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  backgroundColor: 'var(--color-primary)',
                  borderRadius: 'var(--radius-md)'
                }} />
                <Text>Item 1</Text>
                <div style={{ 
                  width: '60px', 
                  height: '20px', 
                  backgroundColor: 'var(--color-accent)',
                  borderRadius: 'var(--radius-md)'
                }} />
                <Text>Item 2</Text>
              </Stack>
            </Stack>

            <Stack spacing="sm">
              <Text weight="medium">Column Direction (Default)</Text>
              <Stack spacing="sm" style={{ maxWidth: '200px' }}>
                <div style={{ 
                  height: '20px', 
                  backgroundColor: 'var(--color-success)',
                  borderRadius: 'var(--radius-md)'
                }} />
                <div style={{ 
                  height: '30px', 
                  backgroundColor: 'var(--color-warning)',
                  borderRadius: 'var(--radius-md)'
                }} />
                <div style={{ 
                  height: '25px', 
                  backgroundColor: 'var(--color-error)',
                  borderRadius: 'var(--radius-md)'
                }} />
              </Stack>
            </Stack>
          </Stack>
        </Card>

        {/* Responsive Demo */}
        <Card>
          <Stack spacing="md">
            <Text as="h2" size="2xl" weight="semibold">Responsive Behavior</Text>
            <Text color="secondary">
              Resize your browser to see responsive spacing and scaling. 
              The container padding and text scale adjust based on viewport size.
            </Text>
            
            <Stack direction="row" spacing="md" wrap>
              {Array.from({ length: 6 }, (_, i) => (
                <Card 
                  key={i} 
                  variant="outlined" 
                  padding="md"
                  style={{ minWidth: '120px', flex: '1 1 auto' }}
                >
                  <Text size="sm" weight="medium" align="center">
                    Item {i + 1}
                  </Text>
                </Card>
              ))}
            </Stack>
          </Stack>
        </Card>
      </Stack>
    </div>
  )
}