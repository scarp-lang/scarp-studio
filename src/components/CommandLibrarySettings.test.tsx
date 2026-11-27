import { describe,expect,it,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CommandLibrarySettings } from './CommandLibrarySettings';
import { EMPTY_COMMAND_LIBRARY } from '../model/commandPaletteLibrary';
describe('command library settings',()=>{
  it('exposes only the explicit management entry before expansion',()=>{
    const onTogglePin=vi.fn(),onMovePin=vi.fn(),onClear=vi.fn();
    const html=renderToStaticMarkup(<CommandLibrarySettings library={EMPTY_COMMAND_LIBRARY} commands={[{id:'save',label:'Save file'}]}
      onTogglePin={onTogglePin} onMovePin={onMovePin} onClear={onClear}/>);
    expect(html).toContain('Manage command palette collections');
    expect(html).not.toContain('Save file');
    expect(onTogglePin).not.toHaveBeenCalled();
    expect(onMovePin).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });
});
