import * as webpack from "webpack";
import { getOptions } from "loader-utils";
import {readFileSync, unlinkSync} from "fs";
import {basename, join} from "path";
import {execFile} from "child_process";

export const proxyBuilder = (filename: string) => `
export default gobridge(fetch('${filename}').then(response => response.arrayBuffer()));
`;

const getGoBin = (root: string) => `${root}/bin/go`;

function loader(this: webpack.loader.LoaderContext, contents: string) {
  const options = getOptions(this);
  console.info({ options });
  const cb = this.async();

  let resourceDirectory = this.resourcePath.substr(0, this.resourcePath.lastIndexOf("/"));

  const opts = {
    env: {
      GO111MODULE: "on",
      GOPATH: process.env.GOPATH,
      GOROOT: process.env.GOROOT,
      GOCACHE: join(__dirname, "./.gocache"),
      GOOS: "js",
      GOARCH: "wasm"
    },
    cwd: resourceDirectory
  };

  const goBin = getGoBin(opts.env.GOROOT);
  const outFile = `${this.resourcePath}.wasm`;
  const args = ["build", "-o", outFile, this.resourcePath];

  execFile(goBin, args, opts, (err) => {
    if (err) {
      cb(err);
      return;
    }
    // TODO: only here for debugging; remove later!
    console.info({ goBin, args, opts, err });

    const out = readFileSync(outFile); // was `let`; necessary?
    try {
      unlinkSync(outFile);
    } catch (e) {
      console.info('unlinking encountered error:', { e });
    }

    const emitFileBasename = basename(this.resourcePath, ".go");
    const emittedFilename = `${emitFileBasename}.wasm`;
    this.emitFile(emittedFilename, out, null);

    // TODO: join(process.env.GOROOT, "/misc/wasm/wasm_exec.js")
    const libPath = join(__dirname, "..", "lib", "wasm_exec.js");
    const bridgePath = join(__dirname, "..", "dist", "gobridge.js");
    // FIXME: This `fetch` wants an absolute address!
    // `__webpack_public_path__ + ${emittedFilename}`?
    // console.info(__webpack_public_path__);
    const proxied = `
      require('!${libPath}');
      import gobridge from '${bridgePath}';
      console.info({ wpPubPath:__webpack_public_path__ }, window.navigator);
      const file = fetch(__webpack_public_path__ + '${emittedFilename}');
      const buffer = file.then(res => res.arrayBuffer());
      export default gobridge(buffer);
    `;
    cb(null, proxied);
  });
}

export default loader;
