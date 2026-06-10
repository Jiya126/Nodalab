import type { BlockDefinition, Shape } from '../types';

export const customBlock: BlockDefinition = {
  type: 'Custom',
  label: 'Custom',
  category: 'special',
  description: 'User-defined custom block. Write your own forward() logic.',
  params: [
    { name: 'code', type: 'string', default: 'return x', label: 'Forward Code' },
    { name: 'output_shape_rule', type: 'select', default: 'same', label: 'Output Shape', options: ['same', 'custom'] },
    { name: 'custom_output_shape', type: 'string', default: 'null,256', label: 'Custom Output Shape' },
  ],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (inputShapes: Shape[], params) => {
    if (params.output_shape_rule === 'same') {
      if (inputShapes.length === 0 || !inputShapes[0] || inputShapes[0].length === 0) return [];
      return [[...inputShapes[0]]];
    }
    const dims = String(params.custom_output_shape || 'null,256').split(',').map(d => {
      const trimmed = d.trim();
      if (trimmed === 'null' || trimmed === 'B') return null;
      const n = parseInt(trimmed, 10);
      return isNaN(n) ? null : n;
    });
    return [dims];
  },
  codeTemplate: {
    init: '# Custom block: {label}',
    forward: '# Custom forward for {label}\n        {out} = {in}  # Replace with custom logic',
  },
};
