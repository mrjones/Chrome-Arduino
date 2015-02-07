package main

import (
	"bytes"
	"fmt"
	"html/template"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"time"
)


type BuildServer struct {
	uploadDirectory string
}

func (s *BuildServer) uploadForm(w http.ResponseWriter, r *http.Request) {
	template.Must(template.ParseFiles(
		"templates/upload_form.html")).Execute(w, nil)
}

func (s *BuildServer) handleUpload(resp http.ResponseWriter, req *http.Request) {
	const ONE_MB = 1024 * 1024;

	err := req.ParseMultipartForm(ONE_MB)
	if err != nil {
		resp.WriteHeader(http.StatusInternalServerError)
		resp.Write([]byte(
			fmt.Sprintf("Error parsing data: %s\n", err.Error())))
		return
	}

	for key, value := range req.MultipartForm.Value {
		log.Printf("%s:%s\n", key, value)
	}

	for k, fileHeaders := range req.MultipartForm.File {
		for i, fileHeader := range fileHeaders {
			log.Printf("===\n=== %s[%d]:%s\n===\n", k, i, fileHeader.Filename)
			file, err := fileHeader.Open()
			if err != nil {
				resp.WriteHeader(http.StatusInternalServerError)
				resp.Write([]byte(
					fmt.Sprintf("Error opening uploaded file: %s\n", err.Error())))
				return
			}
			buf, err := ioutil.ReadAll(file)
			if err != nil {
				resp.WriteHeader(http.StatusInternalServerError)
				resp.Write([]byte(
					fmt.Sprintf("Error reading uploaded file: %s\n", err.Error())))
				return
			}

			uniqueRoot := fmt.Sprintf("%s/%d", s.uploadDirectory, time.Now().UnixNano())
			srcDir := fmt.Sprintf("%s/src", uniqueRoot)
			outfilename := fmt.Sprintf("%s/%s", srcDir, fileHeader.Filename)

			os.MkdirAll(srcDir, os.ModePerm)
			err = ioutil.WriteFile(outfilename, buf, os.ModePerm)
			if err != nil {
				resp.WriteHeader(http.StatusInternalServerError)
				resp.Write([]byte(
					fmt.Sprintf("Error reading uploaded file: %s\n", err.Error())))
				return
			}

			board := "uno"

			cmd := exec.Command("ino", "build", "-m", board)
			cmd.Dir = uniqueRoot

			var cmdOut bytes.Buffer
			cmd.Stdout = &cmdOut
			err = cmd.Run()
			if err != nil {
				resp.WriteHeader(http.StatusInternalServerError)
				resp.Write([]byte("===\n===\n===\n"))
				resp.Write(cmdOut.Bytes())
				resp.Write([]byte(
					fmt.Sprintf("Error compiling: %s\n", err.Error())))
				return
			}

			hexFileName := fmt.Sprintf("%s/.build/%s/firmware.hex", uniqueRoot, board)
			hexData, err := ioutil.ReadFile(hexFileName)
			if err != nil {
				resp.WriteHeader(http.StatusInternalServerError)
				resp.Write([]byte("===\n===\n===\n"))
				resp.Write(cmdOut.Bytes())
				resp.Write([]byte(
					fmt.Sprintf("Error reading hex file: %s %v\n", err)))
				return
			}

			resp.Write(hexData)
		}
	}
}

func main() {
	server := &BuildServer{uploadDirectory: "./uploads"}
	http.HandleFunc("/handle_upload", server.handleUpload)
	http.HandleFunc("/", server.uploadForm)

	log.Println("Listening on port 7221")
	http.ListenAndServe(":7221", nil)
}
