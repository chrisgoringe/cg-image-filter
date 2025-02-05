# CG Image Filter

A set of four nodes designed to pause execution of the workflow to allow you to make selections and/or edits before continuing.
There's an example workflow that illustrates all of them at the end.

- ['Image Filter'](#image-filter) - pause the flow and pick which images from a set you want to proceed with
- ['Mask Image Filter'](#mask-image-filter) - launch the mask editor for the image, and return the image and mask
- ['Text Image Filter'](#text-image-filter) - show the image with some editable text which is returned
- ['Text Image Filter with Extras'](#text-image-filter-with-extras) - as 'Text Image Filter' but with three extra single line texts fields that are also returned

There's also a helper node, 'Split String by Commas' that can be used if you want more extra values.

## Examples of what you might do with them

- Generate an image or batch, and select which ones you want before spending the time upscaling
- Generate an image and pick part of it to inpaint all in one go (the example workflow below does this)
- Edit auto-generated captions before saving them
- Iterate through a folder of images, picking a masked area to inpaint (and the inpainting prompt) for each
- you ideas here...

---

## Image Filter

The image filter node pauses execution of the workflow while you choose which, if any, of the images produced, you want to progress.

Insert it like this:

![image](images/basic.png)

When you run the workflow, and get to this point, a popup window will appear displaying the image(s) for you to select which, if any, 
you want to progress:

![image](images/popup.png)

Click the images that you want to keep (their border will turn green) and then click 'Send' (or press 's') to continue the workflow. 
If you don't want to keep any of the images, click 'Cancel' (or press 'x') to terminate the workflow. 

The node also has a timeout specified, and a countdown is shown on the left hand side. If you don't Send or Cancel before the timeout, 
the node will either cancel or send all the images, depending on the option you have selected.

Here's a simple use: generate a batch of images and pick which ones you want to save:

![workflow](images/workflow.png)

### Checkboxes

- 'Click to send': clicking an image also sends it
- 'autosend one if identical': automatically send a single image if all the images are identical
- 'play sound': play a chime when the window pops up (the sound played is 'ding.mp3' from the 'js' folder)

### Optional inputs

The Latent and Mask inputs are optional. If used, they should have the same number of latents (or masks) as the image batch, 
and the latents (or masks) corresponding to the selected images will be output. Use this if (for instance) you want to 
select from a batch of images, but the next stage uses the latent - that way you avoid the decode-recode loss, or if you want
to pick a mask (perhaps from options automatically generated)

---

## Mask Image Filter

Designed for a single image, when executed the Mask Image Filter node will automatically launch the mask editor. 

![mask](images/mask.png)

When you finish mask editing the image and mask will be output. Here's a simple use - generate an image, and then 
mask the bit you don't like, before doing an img2img step.

![mask workflow](images/mask%20workflow.png)

Again, there is a timeout, and if you don't save a mask before the end of the timeout (or if you press the cancel button in the mask editor), 
it will either cancel, or send a blank mask, depending on the option chosen.

---

## Text Image Filter

Also designed for a single image, this node will show the image and a string of text; you can edit the text and then press send. 

![text](images/text.png)

The image and (edited) text are output. The intended use is for captioning workflows; you can read and edit each caption as it is
generated. Here's a trivial workflow:

![text workflow](images/text%20workflow.png)


## Text Image Filter with Extras

Just like the Text Image Filter, but with three extra text fields, intended for short form - like specifying the denoising you want on the next step.

They are all strings, so you'll probably need to run the output through some sort of conversion node. 
If you need more than three, consider using the 'Split Text by Commas' helper node.

If you use the optional 'tip' input, the contents will be displayed under the extras input fields, so you can remind yourself what they are for!

---

# Example Workflow

![image](images/three%20filters.png)

This workflow:
- generates an image
- uses 'Mask Image Filter' to allow you to mask part of the image for inpainting
- uses 'Text Image Filter with Extras' to enter a prompt (and negative prompt) for the inpainting
- inpaints
- uses 'Image Filter' to choose which, if either, of the two images (before and after inpaint) to save

The workflow is embedded in this seahorse in a bottle:

![image](images/seahorse.png)

# Bugs, Ideas, and the future

Take a look at the [issues list](https://github.com/chrisgoringe/cg-image-filter/issues) to see what I'm thinking of,
to report problems, or to make suggestions.