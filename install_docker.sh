# stop and remove existing docker container first
sudo docker stop roon-extension-onkyo
sudo docker rm roon-extension-onkyo

# create docker container based on node base image
sudo docker run -d --name roon-extension-onkyo --restart on-failure --network host -v "$PWD":/usr/src/app -w /usr/src/app node bash ./run_extension.sh