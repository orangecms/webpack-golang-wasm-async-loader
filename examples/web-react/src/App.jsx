import React, { useEffect, useState } from 'react';
import { useFilePicker } from 'use-file-picker';
import wasm from './main.go';
import NumberInput from './NumberInput';

const { add, fmap, raiseError, someValue } = wasm;

/*
const buffer = new ArrayBuffer(1024 * 1024 * 16);
const indata = new Uint8Array(buffer);
indata[0] = 42;
indata[1] = 23;
indata[2] = 255;
indata[3] = 255;
indata[4] = 13;
indata[5] = 37;
indata[6] = 0;
indata[7] = 0;
indata[8] = 255;
indata[9] = 255;
*/

const entryToEmoji = (e) => {
  switch (e) {
    case "zero": return "😶";
    case "full": return "🆓";
    case "used":
    default:
      return "📦";
  }
};

const LayoutBlocks = ({ layout }) => {
    return (
      <table>
        {layout.map(({ address, entries }) => (
          <tr key={address}>
            <td>{address}</td>
            {entries.map((e, i) => (
              <td key={i}>{entryToEmoji(e)}</td>
            ))}
          </tr>
        ))}
      </table>
    );
};

const Fmap = () => {
  const [data, setData] = useState(null);
  const [
      openFileSelector,
			{ filesContent, loading, errors, plainFiles, clear }
  ] = useFilePicker({
      multiple: true,
      readAs: "ArrayBuffer",
      // accept: ['.bin', '.rom'],
      limitFilesConfig: { min: 1, max: 1 },
      // minFileSize: 1, // in megabytes
      maxFileSize: 65,
      // readFilesContent: false, // ignores file content
  });

    const getFmap = async(indata, size) => {
        const encoded = await fmap(indata, size);
        try {
            const flashMap = JSON.parse(encoded);
            // console.info({ flashMap });
            setData(flashMap);
        } catch (error) {
            console.error({ error });
        }
    }

	useEffect(() => {
    if (filesContent.length) {
      getFmap(
          new Uint8Array(filesContent[0].content),
          filesContent[0].content.byteLength
      );
    }
  }, [filesContent]);

  if (errors.length) {
    return (
      <div>
        <button onClick={() => openFileSelector()}>Something went wrong, retry! </button>
      </div>
    );
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <button onClick={() => openFileSelector()}>
        Select file
      </button>
      {data && <LayoutBlocks layout={data.layout} />}
      {plainFiles.map(file => (
        <div key={file.name}>{file.name}</div>
      ))}
    </div>
  );
};

class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            value: [0, 0],
            result: '0',
            error: undefined
        };
    }

    async componentWillMount() {
      let value = await someValue();
      this.setState({
        someValue: value
      });
    }

    async updateValue(index, value) {
        let newValues = this.state.value.slice();
        newValues[index] = value
        let result = await add(...newValues);
        this.setState({ value: newValues, result });
    }

    async raiseError() {
      try {
        let _ = await raiseError();
      } catch (e) {
        this.setState({
          error: e
        });
      }
    }

    render() {
        return (
            <div>
                <Fmap />
                <p>Enter a number in the box below, on change it will add all the numbers together. Click the button to add more input boxes.</p>
                {this.state.value.map((value, index) =>
                    <NumberInput key={index} value={value} onChange={i => this.updateValue(index, i)} />
                )}
                <button type="button" onClick={() => this.setState({ value: [...this.state.value, 0]})}>More inputs!</button>
                <p>Value now is {this.state.result}</p>
                <div>
                  <p>Click this button to simulate an error: <button type="button" onClick={() => this.raiseError()}>Make error!</button></p>
                  {this.state.error ? <div>
                      <p style={{ color: '#f00' }}>{this.state.error}</p>
                      <button type="button" onClick={() => this.setState({ error: undefined })}>Dismiss</button>
                    </div> : null }
                </div>
                <div>
                  <p>Here's a static value: {this.state.someValue}</p>
                </div>
            </div>
        );
    }
  }

export default App;
