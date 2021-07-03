//+ build js,wasm

package main

import (
	"encoding/json"
	"errors"
	"syscall/js"

	"github.com/happybeing/webpack-golang-wasm-async-loader/gobridge"
)

var global = js.Global()

type FlashLayout struct {
	// Data   []rowEntry `json:"layout"`
	Blocks int `json:"blocks"`
	Full   int `json:"full"`
	Zero   int `json:"zero"`
	Used   int `json:"used"`
}

func fmap(this js.Value, args []js.Value) (interface{}, error) {
	layout := FlashLayout{
		Blocks: 100,
		Full:   30,
		Zero:   10,
		Used:   60,
	}
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
