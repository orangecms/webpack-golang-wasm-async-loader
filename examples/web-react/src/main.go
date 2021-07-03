//+ build js,wasm

package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"syscall/js"

	"github.com/happybeing/webpack-golang-wasm-async-loader/gobridge"
)

var global = js.Global()

type rowEntry struct {
	Entries []string `json:"entries"`
	Address string   `json:"address"`
}

type FlashLayout struct {
	Data   []rowEntry `json:"layout"`
	Blocks int        `json:"blocks"`
	Full   int        `json:"full"`
	Zero   int        `json:"zero"`
	Used   int        `json:"used"`
}

func fmap(this js.Value, args []js.Value) (interface{}, error) {
	blockSize := 2
	rowLength := 4

	buffer := make([]byte, blockSize)
	fullBlock := bytes.Repeat([]byte{0xff}, blockSize)
	zeroBlock := bytes.Repeat([]byte{0x00}, blockSize)

	var layout FlashLayout
	var numBlocks, numFull, numZero int

	// var slice []byte
	slice := make([]byte, 32)
	js.CopyBytesToGo(slice, args[0])
	indata := bytes.NewReader(slice)

loop:
	for {
		var row rowEntry
		row.Address = fmt.Sprintf("%#08x", numBlocks*blockSize)
		for col := 0; col < rowLength; col++ {
			// Read next block.
			_, err := io.ReadFull(indata, buffer)
			if err == io.EOF {
				break loop
			} else if err == io.ErrUnexpectedEOF {
				break loop
			} else if err != nil {
				return nil, err
			}
			numBlocks++

			// Analyze block.
			if bytes.Equal(buffer, fullBlock) {
				numFull++
				row.Entries = append(row.Entries, "full")
			} else if bytes.Equal(buffer, zeroBlock) {
				numZero++
				row.Entries = append(row.Entries, "zero")
			} else {
				row.Entries = append(row.Entries, "used")
			}
		}
		layout.Data = append(layout.Data, row)
	}
	layout.Blocks = numBlocks
	layout.Full = numFull
	layout.Zero = numZero
	layout.Used = numBlocks - numFull - numZero
	data, err := json.MarshalIndent(layout, "", "  ")
	if err != nil {
		return nil, err
	}

	return string(data), nil
}

func add(this js.Value, args []js.Value) (interface{}, error) {
	ret := 0

	for _, item := range args {
		val := item.Int()
		ret += val
	}

	return ret, nil
}

func err(this js.Value, args []js.Value) (interface{}, error) {
	return nil, errors.New("This is an error")
}

func main() {
	c := make(chan struct{}, 0)
	println("Web Assembly is ready")
	gobridge.RegisterCallback("add", add)
	gobridge.RegisterCallback("fmap", fmap)
	gobridge.RegisterCallback("raiseError", err)
	gobridge.RegisterValue("someValue", "Hello World")
	gobridge.RegisterValue("numericValue", 123)

	<-c // Makes the Go process wait until we want it to end
}
