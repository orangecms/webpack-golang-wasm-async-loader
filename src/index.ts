import * as webpack from "webpack";
import {readFileSync, unlinkSync} from "fs";
import {basename, join} from "path";
import {execFile} from "child_process";

const proxyBuilder = (filename: string) => `
export default gobridge(fetch('${filename}').then(response => response.arrayBuffer()));
`;

const getGoBin = (root: string) => `${root}/bin/go`;

function loader(this: webpack.loader.LoaderContext, contents: string) {
  const cb = this.async();

  let resourceDirectory = this.resourcePath.substr(0, this.resourcePath.lastIndexOf("/"));
  console.info({ resourceDirectory });

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

  // TODO: remove debug code...
  execFile("/usr/bin/env", [], opts, (err, out) => {
      if (out) {
          console.log(out);
          return;
      }
  });

  const goBin = getGoBin(opts.env.GOROOT);
  const outFile = `${this.resourcePath}.wasm`;
  // force rebuild (a); print commands (x); print package names (v)
  const args = ["build", "-x", "-a", "-v", "-o", outFile, this.resourcePath];  // TODO: remove this
  // const args = ["build", "-o", outFile, this.resourcePath];

  execFile(goBin, args, opts, (err) => {
    if (err) {
      cb(err);
      return;
    }
    // TODO: only here for debugging; remove later!
    console.info({ goBin, args, opts, err });
    let out = readFileSync(outFile);
    unlinkSync(outFile);
    const emittedFilename = basename(this.resourcePath, ".go") + ".wasm";
    this.emitFile(emittedFilename, out, null);

    cb(
      null,
      [
        "require('!",
        // join(process.env.GOROOT, "/misc/wasm/wasm_exec.js"),
        join(__dirname, "..", "lib", "wasm_exec.js"),
        "');",
        "import gobridge from '",
        join(__dirname, "..", "dist", "gobridge.js"),
        "';",
        proxyBuilder(emittedFilename)
      ].join("")
    );
  });
}

export default loader;
